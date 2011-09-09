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
module.exports = {

    "id": "Curve9300",
    "name": "Blackberry Curve 9300",
    "model": "9300",
    "osName": "Blackberry OS",
    "uuid": "42",
    "osVersion": "5",
    "firmware": "5",
    "manufacturer": "Research In Motion",

    "skin": "Curve9300",

    "capabilities": [
        "location.gps",
        "location.maps",
        "media.audio.capture",
        "media.video.capture",
        "media.recording",
        "storage.memorycard",
        "network.bluetooth",
        "network.wlan",
        "network.3gpp"
    ],

    "screen": {
        "width": 320,
        "height": 240
    },
    "viewPort": {
        "portrait": {
            "width": 320,
            "height": 240,
            "paddingTop": 0,
            "paddingLeft": 0
        }
    },

    "ppi": 163,
    "userAgent": "BlackBerry9300/5.0.0.637 Profile/MIDP-2.1 Configuration/CLDC-1.1 VendorID/1",
    "browser": ["BlackBerry Browser"],
    "platforms": ["web", "phonegap", "webworks.handset"]
};