<?php

namespace App\Console\Commands;

use App\Thresholds\ThresholdEvaluator;
use Illuminate\Console\Command;

class EvaluateThresholds extends Command
{
    protected $signature = 'raccoon:evaluate-thresholds';

    protected $description = 'Open performance issues for groups whose recent p95 duration is over their threshold';

    public function handle(ThresholdEvaluator $evaluator): int
    {
        $exceeded = $evaluator->evaluateAll();

        $this->info("{$exceeded} ".str('group')->plural($exceeded).' over threshold.');

        return self::SUCCESS;
    }
}
