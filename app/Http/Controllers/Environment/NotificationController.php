<?php

namespace App\Http\Controllers\Environment;

class NotificationController extends MessageController
{
    protected const TABLE = 'notifications';

    protected const PAGE = 'Notifications';

    protected const LIST = 'notifications';

    protected const COLUMNS = 'class, channel, duration, failed';
}
