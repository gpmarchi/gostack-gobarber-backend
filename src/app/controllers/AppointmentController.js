import * as Yup from 'yup';
import { startOfHour, parseISO, isBefore } from 'date-fns';

import Appointment from '../models/Appointment';
import User from '../models/User';
import File from '../models/File';

class AppointmentController {
  async index(req, res) {
    const appointments = await Appointment.findAll({
      where: {
        user_id: req.userId,
        cancelled_at: null,
      },
      order: ['date'],
      attributes: ['id', 'date'],
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
    const isHourScheduled = await Appointment.findOne({
      where: {
        date: hourStart,
        provider_id,
        cancelled_at: null,
      },
    });

    if (isHourScheduled) {
      return res
        .status(400)
        .json({ error: 'Provider already scheduled for selected date.' });
    }

    const appointment = await Appointment.create({
      date: hourStart,
      user_id: req.userId,
      provider_id,
    });

    return res.json(appointment);
  }
}

export default new AppointmentController();
