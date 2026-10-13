<?php

namespace App\Notifications;

use App\Models\OrganizationInvite;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class OrganizationInvitation extends Notification
{
    public function __construct(public OrganizationInvite $invite, public string $url)
    {
        //
    }

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $organization = $this->invite->organization->name;
        $inviter = $this->invite->inviter?->name;

        return (new MailMessage)
            ->subject("Join {$organization} on Raccoon")
            ->line(($inviter ? "{$inviter} invited you" : 'You have been invited')." to join the {$organization} organization as {$this->invite->role}.")
            ->action('Accept invite', $this->url)
            ->line('This invite expires '.$this->invite->expires_at->diffForHumans().'.');
    }
}
