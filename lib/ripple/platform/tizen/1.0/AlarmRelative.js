/*
 *  Copyright 2012 Intel Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var AlarmBase = require('ripple/platform/tizen/1.0/AlarmBase');

module.exports = function (delay, period) {
    var alarm, date;

    alarm  = new AlarmBase();
    delay  = delay || 0;
    period = period || null;
    date   = new Date(); // Alarm settime

    alarm.getRemainingSeconds = function () {
        var current, diff, triggerDate, MILLI_SECOND = 1000;
        current     = new Date();
        triggerDate = new Date(delay * MILLI_SECOND + date.getTime()); // First triggerDate
        diff        = Math.round((triggerDate - current) / MILLI_SECOND);

        if (diff > 0) // Before first trigger
            return diff;

        if (period === null)
            return null; // Alarm is expired

        while (current - triggerDate >= 0) { // Trigger repeatly
            triggerDate = new Date(period * MILLI_SECOND + triggerDate.getTime());
        }
        diff = Math.round(((triggerDate - current) / MILLI_SECOND));
        return diff;
    };

    alarm.__defineGetter__("delay", function () {
        return delay;
    });
    alarm.__defineGetter__("period", function () {
        return period;
    });
    alarm.__defineGetter__("date", function () {
        return date;
    });
    alarm.__defineSetter__("date", function (_date) {
        date = new Date(_date);
    });

    return alarm;
};
