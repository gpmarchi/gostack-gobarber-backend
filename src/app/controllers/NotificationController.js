import User from '../models/User';
import Notification from '../schemas/Notification';

class NotificationController {
  async index(req, res) {
    const isProvider = User.findOne({
      where: { id: req.userId, provider: true },
    });

    if (!isProvider) {
      return res
        .status(400)
        .json({ error: 'Logged in user is not a provider.' });
    }

    const notifications = await Notification.find({ user: req.userId })
      .limit(20)
      .sort({ createdAt: 'desc' });

    return res.json(notifications);
  }
}

export default new NotificationController();
