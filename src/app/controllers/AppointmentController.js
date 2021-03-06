import * as Yup from 'yup';
import { startOfHour, parseISO, isBefore, format, subHours } from 'date-fns';
import pt from 'date-fns/locale/pt';

import Appointment from '../models/Appointment';
import User from '../models/User';
import File from '../models/File';
import Notification from '../schemas/Notification';

import CancellationMail from '../jobs/CancellationMail';
import Queue from '../../lib/Queue';

class AppointmentController {
  async index(req, res) {
    const { page = 1 } = req.query;

    const appointments = await Appointment.findAll({
      where: {
        user_id: req.userId,
        cancelled_at: null,
      },
      order: ['date'],
      limit: 20,
      offset: (page - 1) * 20,
      attributes: ['id', 'date', 'past', 'cancellable'],
      include: [
        {
          model: User,
          as: 'provider',
          attributes: ['id', 'name'],
          include: [
            {
              model: File,
              as: 'avatar',
              attributes: ['id', 'path', 'url'],
            },
          ],
        },
      ],
    });

    return res.json(appointments);
  }

  async store(req, res) {
    const appointmentSchema = Yup.object().shape({
      provider_id: Yup.number().required(),
      date: Yup.date().required(),
    });

    if (!(await appointmentSchema.isValid(req.body))) {
      return res.status(400).json({ error: 'Field validation failed.' });
    }

    const { provider_id, date } = req.body;

    /**
     * Check if provider_id exists and is a service provider
     */
    const isProvider = await User.findOne({
      where: { id: provider_id, provider: true },
    });

    if (!isProvider) {
      return res.status(404).json({ error: 'Provider not found.' });
    }

    /**
     * Check if provider is trying to schedule an appointment to oneself
     */
    if (provider_id === req.userId) {
      return res
        .status(400)
        .json({ error: "Can't schedule service to oneself." });
    }

    const hourStart = startOfHour(parseISO(date));

    /**
     * Check if selected appointment date is a past date
     */
    if (isBefore(hourStart, new Date())) {
      return res.status(400).json({ error: 'Past dates are not allowed.' });
    }

    /**
     * Check if selected appointment date is available in provider's agenda
     */
    const isHourAlreadyScheduled = await Appointment.findOne({
      where: {
        date: hourStart,
        provider_id,
        cancelled_at: null,
      },
    });

    if (isHourAlreadyScheduled) {
      return res
        .status(400)
        .json({ error: 'Provider already scheduled for selected date.' });
    }

    const appointment = await Appointment.create({
      date: hourStart,
      user_id: req.userId,
      provider_id,
    });

    /**
     * Notify provider there's a new appointment
     */
    const user = await User.findByPk(req.userId);

    const formattedDate = format(hourStart, "dd 'de' MMMM', às 'H:mm'h'", {
      locale: pt,
    });

    await Notification.create({
      content: `Novo agendamento de ${user.name} para dia ${formattedDate}`,
      user: provider_id,
    });

    return res.json(appointment);
  }

  async delete(req, res) {
    const appointment = await Appointment.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'provider',
          attributes: ['name', 'email'],
        },
        {
          model: User,
          as: 'user',
          attributes: ['name'],
        },
      ],
    });

    if (appointment.user_id !== req.userId) {
      return res.status(400).json({
        error: "You don't have permission to cancel this appointment.",
      });
    }

    if (appointment.cancelled_at) {
      return res.status(400).json({ error: 'Appointment already cancelled.' });
    }

    const allowedCancellationDate = subHours(appointment.date, 2);

    if (isBefore(allowedCancellationDate, new Date())) {
      return res.status(400).json({
        error:
          'You can only cancel appointments with minimum of 2 hours in advance.',
      });
    }

    appointment.cancelled_at = new Date();

    await appointment.save();

    await Queue.add(CancellationMail.key, { appointment });

    return res.json(appointment);
  }
}

export default new AppointmentController();
