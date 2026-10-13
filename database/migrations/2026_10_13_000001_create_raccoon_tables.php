<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Installs from before this file was renamed already have the tables.
        if (Schema::hasTable('organizations')) {
            return;
        }

        Schema::create('organizations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('avatar_url')->nullable();
            $table->unsignedSmallInteger('lookback_period')->default(30);
            $table->timestamps();
        });

        Schema::create('organization_user', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('role')->default('member'); // owner, admin, member
            $table->timestamps();
            $table->unique(['organization_id', 'user_id']);
        });

        Schema::create('organization_invites', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('invited_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('email');
            $table->string('role')->default('member');
            $table->string('token', 64)->unique();
            $table->timestamp('expires_at');
            $table->timestamps();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->foreignUuid('current_organization_id')->nullable()->constrained('organizations')->nullOnDelete();
            $table->string('avatar_url')->nullable();
        });

        Schema::create('applications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('avatar_url')->nullable();
            $table->unsignedSmallInteger('issue_auto_resolve_in_days')->nullable();
            $table->unsignedBigInteger('next_issue_ref')->default(1);
            $table->timestamps();
        });

        Schema::create('environments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('application_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('color')->default('blue');
            $table->text('token'); // encrypted, shown in settings
            $table->string('token_hash', 64)->unique(); // sha256 for agent auth lookup
            $table->timestamp('last_ingested_at')->nullable();
            $table->timestamps();
        });

        Schema::create('deployments', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('environment_id')->constrained()->cascadeOnDelete();
            $table->string('deploy');
            $table->string('ref')->nullable();
            $table->string('name')->nullable();
            $table->string('url')->nullable();
            $table->timestamp('deployed_at', 6);
            $table->timestamps();
            $table->unique(['environment_id', 'deploy']);
            $table->index(['environment_id', 'deployed_at']);
        });

        Schema::create('issues', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('application_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('ref');
            $table->string('type'); // exception, performance
            $table->string('issueable_type'); // exception, route, job, command, scheduled_task
            $table->string('group', 64);
            $table->string('status')->default('open'); // open, resolved, ignored
            $table->unsignedTinyInteger('priority')->default(0); // 0 none .. 4 urgent
            $table->text('title');
            $table->text('subtitle')->nullable();
            $table->text('description')->nullable();
            $table->foreignId('assignee_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('resolve_on_deploy_environment_id')->nullable()->constrained('environments')->nullOnDelete();
            $table->timestamp('first_seen_at');
            $table->timestamp('last_seen_at');
            $table->unsignedBigInteger('occurrences')->default(0);
            $table->unsignedBigInteger('impacted_users')->default(0);
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();
            $table->unique(['application_id', 'ref']);
            $table->unique(['application_id', 'issueable_type', 'group']);
            $table->index(['application_id', 'status', 'last_seen_at']);
        });

        Schema::create('issue_environment', function (Blueprint $table) {
            $table->id();
            $table->foreignId('issue_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('environment_id')->constrained()->cascadeOnDelete();
            $table->timestamp('first_seen_at');
            $table->timestamp('last_seen_at');
            $table->unsignedBigInteger('occurrences')->default(0);
            $table->unique(['issue_id', 'environment_id']);
        });

        Schema::create('issue_activities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('issue_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type'); // created, status_updated, priority_updated, assigned, reopened, comment
            $table->json('data')->nullable();
            $table->timestamps();
        });

        Schema::create('issue_subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('issue_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['issue_id', 'user_id']);
        });

        Schema::create('thresholds', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('application_id')->constrained()->cascadeOnDelete();
            $table->string('type'); // route, job, command, scheduled_task
            $table->string('group', 64);
            $table->string('name');
            $table->unsignedInteger('threshold_ms');
            $table->timestamps();
            $table->unique(['application_id', 'type', 'group']);
        });

        Schema::create('webhooks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('application_id')->constrained()->cascadeOnDelete();
            $table->string('url');
            $table->json('events');
            $table->string('secret', 64);
            $table->boolean('enabled')->default(true);
            $table->timestamps();
        });

        Schema::create('webhook_deliveries', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('webhook_id')->constrained()->cascadeOnDelete();
            $table->string('event');
            $table->json('payload');
            $table->unsignedSmallInteger('status_code')->nullable();
            $table->text('response')->nullable();
            $table->timestamps();
        });

        Schema::create('notification_preferences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('environment_id')->constrained()->cascadeOnDelete();
            $table->boolean('issue_created')->default(true);
            $table->boolean('issue_reopened')->default(true);
            $table->boolean('issue_assigned')->default(true);
            $table->boolean('threshold_exceeded')->default(true);
            $table->timestamps();
            $table->unique(['user_id', 'environment_id']);
        });
    }

    public function down(): void
    {
        foreach (['notification_preferences', 'webhook_deliveries', 'webhooks', 'thresholds', 'issue_subscriptions', 'issue_activities', 'issue_environment', 'issues', 'deployments', 'environments', 'applications'] as $table) {
            Schema::dropIfExists($table);
        }

        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('current_organization_id');
            $table->dropColumn('avatar_url');
        });

        Schema::dropIfExists('organization_invites');
        Schema::dropIfExists('organization_user');
        Schema::dropIfExists('organizations');
    }
};
