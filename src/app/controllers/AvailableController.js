import { Op } from 'sequelize';
import {
  startOfDay,
  endOfDay,
  format,
  setSeconds,
  setMinutes,
  setHours,
  isAfter,
} from 'date-fns';

import Appointment from '../models/Appointment';

class AvailableController {
  async index(req, res) {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'Specify a correct date.' });
    }

    const searchDate = Number(date);

    const appointments = await Appointment.findAll({
      where: {
        provider_id: req.params.providerId,
        cancelled_at: null,
        date: {
          [Op.between]: [startOfDay(searchDate), endOfDay(searchDate)],
        },
      },
    });

    const timeTable = [
      '08:00',
      '09:00',
      '10:00',
      '11:00',
      '12:00',
      '13:00',
      '14:00',
      '15:00',
      '16:00',
      '17:00',
      '18:00',
      '19:00',
    ];

    const available = timeTable.map(time => {
      const [hour, minute] = time.split(':');

      const convertedSearchDate = setSeconds(
        setMinutes(setHours(searchDate, hour), minute),
        0
      );

      return {
        time,
        dateTime: format(convertedSearchDate, "yyyy-MM-dd'T'HH:mm:ssxxx"),
        now: format(new Date(), "yyyy-MM-dd'T'HH:mm:ssxxx"),
        available:
          isAfter(convertedSearchDate, new Date()) &&
          !appointments.find(a => format(a.date, 'HH:mm') === time),
      };
    });

    return res.json(available);
  }
}

export default new AvailableController();
