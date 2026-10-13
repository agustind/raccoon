<?php

namespace App\Http\Controllers\Environment;

class MailController extends MessageController
{
    protected const TABLE = 'mail';

    protected const PAGE = 'Mail';

    protected const LIST = 'mail';

    protected const COLUMNS = 'class, mailer, subject, to, cc, bcc, attachments, duration, failed';
}
