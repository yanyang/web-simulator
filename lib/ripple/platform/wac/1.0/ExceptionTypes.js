/*
 *  Copyright 2011 Research In Motion Limited.
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
var _self =  {};

_self.__defineGetter__("INVALID_PARAMETER", function () {
    return "invalid_parameter";
});

_self.__defineGetter__("SECURITY", function () {
    return "security";
});

_self.__defineGetter__("UNKNOWN", function () {
    return "unknown";
});

_self.__defineGetter__("UNSUPPORTED", function () {
    return "unsupported";
});

module.exports = _self;
