<?php

// Dashboard pages for one environment, prefixed with environments/{environment}
// and named environments.* (see routes/web.php). Each feature area owns one
// file in routes/environment/.

foreach (glob(__DIR__.'/environment/*.php') as $file) {
    require $file;
}
