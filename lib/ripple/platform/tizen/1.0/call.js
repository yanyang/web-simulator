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

var utils = require('ripple/utils'),
    db = require('ripple/db'),
    event = require('ripple/event'),
    errorcode = require('ripple/platform/tizen/1.0/errorcode'),
    WebAPIError = require('ripple/platform/tizen/1.0/WebAPIError'),
    tizen1_utils = require('ripple/platform/tizen/1.0/tizen1_utils'),
    _history,
    _currentServiceIndex = 0,
    _data = {
        DB_CALL_KEY: "tizen1-db-call",
        isCallInProgress: false,
        observers: {},
        callServices: [],
        callHistory: []
    },
    _security = {
        "http://tizen.org/api/call": [],
        "http://tizen.org/api/call.simple": ["getCallServices", "isCallInProgress"],
        "http://tizen.org/api/call.history": ["history"],
        "http://tizen.org/api/call.history.read": ["find", "addListener", "removeListener"],
        "http://tizen.org/api/call.history.write": ["CallHistoryEntry", "remove", "removeBatch", "removeAll"],
        all: true
    },
    CALL_SERVICE_TYPE = ["tizen.tel", "tizen.xmpp", "tizen.sip"],
    CALL_SERVICE_TAG = ["call", "call.voice", "call.video", "call.emergency"],
    _RECORDING_KEY = "tizen1-call-recording",
    _RECORDING_PATH = "music/",
    _self;

function _getValue(inputValue, key) {
    var keys = key.split("."),
        value = inputValue[keys[0]],
        index;

    for (index = 1; index < keys.length; index++) {
        if (value[keys[index]]) {
            value = value[keys[index]];
        }
    }

    return value;
}

function _filter(inputArray, filter) {
    var index, filterResults = [], compositeResultArray;

    if (filter === null || filter === undefined) {
        return inputArray;
    }

    if (filter.attributeName === null || filter.attributeName === undefined) {
        throw new WebAPIError(errorcode.TYPE_MISMATCH_ERR);
    }

    if (filter.matchFlag) {
        filterResults = tizen1_utils.matchAttributeFilter(inputArray, filter.attributeName, filter.matchFlag, filter.matchValue);
    }
    else if (filter.initialValue || filter.endValue) {
        filterResults = tizen1_utils.matchAttributeRangeFilter(inputArray, filter.attributeName, filter.initialValue, filter.endValue);
    }
    else if (filter.type && filter.filters) {
        for (index = 0; index < filter.filters.length; index++) {
            compositeResultArray = _filter(inputArray, filter.filters[index]);

            filterResults = tizen1_utils.arrayComposite(filter.type, filterResults, compositeResultArray);
        }
    }

    return filterResults;
}

function _sort(inputArray, sortMode) {
    if (sortMode.attributeName === null || sortMode.attributeName === undefined) {
        throw new WebAPIError(errorcode.TYPE_MISMATCH_ERR);
    }

    inputArray.sort(function (a, b) {
        return sortMode.order === "DESC" ? _getValue(a, sortMode.attributeName) - _getValue(b, sortMode.attributeName) :
               _getValue(b, sortMode.attributeName) - _getValue(a, sortMode.attributeName);
    });

    return inputArray;
}

function _save() {
    db.saveObject(_data.DB_CALL_KEY, _data.callHistory);
}

function _retrive() {
    var callHistoryList, callHistory, index;
    
    if (_data.callHistory.length === 0) {
        callHistoryList = db.retrieveObject(_data.DB_CALL_KEY) || [];

        for (index = 0; index < callHistoryList.length; index++) {
            callHistory = callHistoryList[index];
            _data.callHistory.push(_getCallHistoryEntry(callHistory.serviceId, callHistory.callType, callHistory.tags,
                                       callHistory.callParticipants, callHistory.forwardedFrom, 
                                       callHistory.startTime, callHistory.duration, callHistory.endReason,
                                       callHistory.direction, callHistory.recording, callHistory.cost, callHistory.currency));
        }
    }

    return tizen1_utils.copy(_data.callHistory);
}

function _deleteRecording(id) {
    var path = _RECORDING_PATH + id + ".mp3",
        recording = [];

    recording = db.retriveObject(_RECORDING_KEY);
    recording = recording.filter(function (element) {
        return element !== path;
    });
    
    db.saveObject(_RECORDING_KEY, recording);
}

function _isCallHistoryEntryType(arg) {
    return arg && arg.hasOwnProperty("serviceId") && arg.hasOwnProperty("callType") &&
           arg.hasOwnProperty("tags") && arg.hasOwnProperty("callParticipants") && 
           arg.hasOwnProperty("forwardedFrom") && arg.hasOwnProperty("startTime") &&
           arg.hasOwnProperty("duration") && arg.hasOwnProperty("endReason") &&
           arg.hasOwnProperty("direction") && arg.hasOwnProperty("recording") && 
           arg.hasOwnProperty("cost") && arg.hasOwnProperty("currency");
}

function _isCallServiceFilterType(arg) {
    if (arg && arg.hasOwnProperty("serviceTypeId") && !utils.arrayContains(CALL_SERVICE_TYPE, arg["serviceTypeId"])) {
        return false;
    }

    if (arg && arg.hasOwnProperty("tags")) {
        if (!tizen1_utils.isValidArray(arg["tags"])) {
            return false;
        }
        else if (arg["tags"].some(function (element) {
            return !utils.arrayContains(CALL_SERVICE_TAG, element);
        })) {
            return false;
        }
    }

    return true;
}

function _getRemoteParty(remoteParty, displayName, contactRef) {
    var _contactRef = tizen1_utils.copy(contactRef),
        _self = {};

    _self.__defineGetter__("remoteParty", function () {
        return remoteParty;
    });

    _self.__defineGetter__("displayName", function () {
        return displayName;
    });

    _self.__defineGetter__("contactRef", function () {
        return _contactRef;
    });

    return _self;
}

function _getCallHistoryEntry(serviceId, callType, tags, callParticipants,
                              forwardedFrom, startTime, duration, endReason,
                              direction, recording, cost, currency) {
    var _tags = tizen1_utils.copy(tags),
        _callParticipants = [],
        _forwardedFrom = forwardedFrom ? _getRemoteParty(forwardedFrom.remoteParty, forwardedFrom.displayName, forwardedFrom.contactRef) : {},
        _startTime = new Date(startTime),
        _recording = tizen1_utils.copy(recording),
        _self = {},
        participantItem,
        index;

    for (index = 0; index < callParticipants.length; index++) {
        participantItem = callParticipants[index];
        _callParticipants.push(_getRemoteParty(participantItem.id, participantItem.displayName, participantItem.contactRef));
    }

    _self.__defineGetter__("serviceId", function () {
        return serviceId;
    });

    _self.__defineGetter__("callType", function () {
        return callType;
    });

    _self.__defineGetter__("tags", function () {
        return _tags;
    });

    _self.__defineGetter__("callParticipants", function () {
        return _callParticipants;
    });

    _self.__defineGetter__("forwardedFrom", function () {
        return _forwardedFrom;
    });

    _self.__defineGetter__("startTime", function () {
        return _startTime;
    });

    _self.__defineGetter__("duration", function () {
        return duration;
    });

    _self.__defineGetter__("endReason", function () {
        return endReason;
    });

    _self.direction = direction;

    _self.__defineGetter__("recording", function () {
        return _recording;
    });

    _self.__defineGetter__("cost", function () {
        return cost;
    });

    _self.currency = currency;

    return _self;
}

function AccountServiceClass(serviceName, serviceTypeId, providerId, tags) {
    var _self = {
        serviceName: serviceName,
        serviceTypeId: serviceTypeId,
        providerId: providerId,
        tags: tags
    };

    this.__defineGetter__("serviceName", function () {
        return _self.serviceName;
    });
    this.__defineGetter__("serviceTypeId", function () {
        return _self.serviceTypeId;
    });
    this.__defineGetter__("providerId", function () {
        return _self.providerId;
    });
    this.__defineGetter__("tags", function () {
        return _self.tags;
    });

    this.applicationId = "";
    this.displayName = "";
    this.icon = "";
    this.enabled = false;
    this.settings = "";
}

function AccountService() {
    var _self = {
        id: "",
        accountId: ""
    };

    if (arguments.length >= 4) {
        AccountServiceClass.call(this, arguments[0], arguments[1], arguments[2], arguments[3]);
    }
    else {
        AccountServiceClass.call(this);
    }

    this.__defineGetter__("id", function () {
        return _self.id;
    });
    this.__defineGetter__("accountId", function () {
        return _self.accountId;
    });
}

function CallService() {
    if (arguments.length >= 4) {
        AccountService.call(this, arguments[0], arguments[1], arguments[2], arguments[3]);
    }
    else {
        AccountService.call(this);
    }

    this.launchDialer = function (remoteParty, successCallback, errorCallback, extension) {
        if (remoteParty === null || remoteParty === undefined) {
            throw new WebAPIError(errorcode.INVALID_VALUES_ERR);
        }

        if ((successCallback && typeof successCallback !== "function") || 
            (errorCallback && typeof errorCallback !== "function")) {
            throw new WebAPIError(errorcode.TYPE_MISMATCH_ERR);
        }

        // The ui pannel will respnd this event and launch the dailer panel
        event.trigger("DialerLaunched", [remoteParty]);
    };

    this.__defineGetter__("voicemailNumbers", function () {
        return "13800100200";
    });
}

function CellularCallService() {
    var subscriberNumbers = ["10086"],
        emergencyNumbers = ["110", "911", "120"];

    if (arguments.length >= 4) {
        CallService.call(this, arguments[0], arguments[1], arguments[2], arguments[3]);
    }
    else {
        CallService.call(this);
    }

    this.sendUSSD = function (command, successCallback, errorCallback) {
        var response = "";
    
        if (command === null || command === undefined) {
            throw new WebAPIError(errorcode.INVALID_VALUES_ERR);
        }

        if ((successCallback && typeof successCallback !== "function") ||
            (errorCallback && typeof errorCallback !== "function")) {
            throw new WebAPIError(errorcode.TYPE_MISMATCH_ERR);
        }

        if (command === "*#06#") {
            response = "352099001761482";
        }
        else {
            response = "simulated USSD response";
        }

        setTimeout(successCallback(response), 1);
    };    

    this.__defineGetter__("subscriberNumbers", function () {
        return subscriberNumbers;
    });

    this.__defineGetter__("emergencyNumbers", function () {
        return emergencyNumbers;
    });
}

function CallHistory() {
    this.find = function (successCallback, errorCallback, filter, sortMode, limit, offset) {
        var callHistory = _retrive(),
            filterResults = callHistory,
            limitValue = limit | 0,
            offsetValue = offset | 0;

            if (!_security.all && !_security.history && !_security.find) {
                throw new WebAPIError(errorcode.SECURITY_ERR);
            }

            if (successCallback === null || successCallback === undefined) {
                throw new WebAPIError(errorcode.TYPE_MISMATCH_ERR);
            }

            if (typeof successCallback !== "function" || (errorCallback && typeof errorCallback !== "function")) {
                throw new WebAPIError(errorcode.TYPE_MISMATCH_ERR);
            }

        setTimeout(function () {
            if (filter) {
                filterResults = _filter(callHistory, filter);
            }
            
            if (sortMode) {
                _sort(filterResults, sortMode);
            }

            if (limitValue > 0) {
                offsetValue = offsetValue > 0 ? offsetValue : 0;
                filterResults = filterResults.slice(offsetValue, limitValue);
            }

            successCallback(filterResults);
        }, 1);
    };
    this.remove = function (entry) {
        var isFound = false;

        if (!_security.all && !_security.history && !_security.remove) {
            throw new WebAPIError(errorcode.SECURITY_ERR);
        }

        if (!_isCallHistoryEntryType(entry)) {
            throw new WebAPIError(errorcode.TYPE_MISMATCH_ERR);
        }

        _data.callHistory = _data.callHistory.filter(function (element) {
            return utils.some(element, function (value, key) {
                if (tizen1_utils.isEqual(entry[key], value)) {
                    isFound = true;
                    return false;
                }
                return true;
            });
        });

        if (!isFound) {
            throw new WebAPIError(errorcode.NOT_FOUND_ERR);
        }

        _save();
    };
    this.removeBatch = function (entries, successCallback, errorCallback) {
        var isFound = false, index;

        if (!_security.all && !_security.history && !_security.removeBatch) {
            throw new WebAPIError(errorcode.SECURITY_ERR);
        }

        if ((successCallback && typeof successCallback !== "function") ||
            (errorCallback && typeof errorCallback !== "function")) {
            throw new WebAPIError(errorcode.TYPE_MISMATCH_ERR);
        }

        for (index = 0; index < entries.length; index++) {
            if (!_isCallHistoryEntryType(entries[index])) {
                throw new WebAPIError(errorcode.TYPE_MISMATCH_ERR);
            }
        }

        setTimeout(function () {
            isFound = entries.every(function (element) {
                return _data.callHistory.some(function (callHistory) {
                    return tizen1_utils.isEqual(element, callHistory);
                });
            });

            if (!isFound) {
                if (errorCallback) {
                    errorCallback(new WebAPIError(errorcode.NOT_FOUND_ERR));
                    return;
                }
                else {
                    throw new WebAPIError(errorcode.NOT_FOUND_ERR);
                }
            }

            _data.callHistory = _data.callHistory.filter(function (element) {
                return !entries.some(function (entryValue, entryIndex) {
                    return tizen1_utils.isEqual(element, entryValue);
                });
            });
        
            _save();

            if (successCallback) {
                successCallback(_retrive());
            }
        }, 1);
    };
    this.removeAll = function (successCallback, errorCallback) {
        var removedEntries = [];

        if (!_security.all && !_security.history && !_security.removeAll) {
            throw new WebAPIError(errorcode.SECURITY_ERR);
        }

        if ((successCallback && typeof successCallback !== "function") ||
            (errorCallback && typeof errorCallback !== "function")) {
            throw new WebAPIError(errorcode.TYPE_MISMATCH_ERR);
        }

        removedEntries = _retrive();
        _data.callHistory = [];
        _save();

        if (successCallback) {
            successCallback(removedEntries);
        }
    };
    this.deleteRecording = function (historyEntry, successCallback, errorCallback) {
        var isFound = false;

        if (!_security.all && !_security.history && !_security.deleteRecording) {
            throw new WebAPIError(errorcode.SECURITY_ERR);
        }

        if ((successCallback && typeof successCallback !== "function") ||
            (errorCallback && typeof errorCallback !== "function")) {
            throw new WebAPIError(errorcode.TYPE_MISMATCH_ERR);
        }

        if (!_isCallHistoryEntryType(historyEntry) || historyEntry["recording"] === null) {
            throw new WebAPIError(errorcode.TYPE_MISMATCH_ERR);
        }

        isFound = _data.callHistory.some(function (callHistory, index) {
            if (tizen1_utils.isEqual(historyEntry, callHistory)) {
                _data.callHistory[index]["recording"] = null;
                return true;
            }
            return false;
        });

        if (!isFound) {
            if (errorCallback) {
                errorCallback(new WebAPIError(errorcode.NOT_FOUND_ERR));
                return;
            }
            else {
                throw new WebAPIError(errorcode.NOT_FOUND_ERR);
            }
        }

        _deleteRecording(historyEntry.serviceId);
        _save();

        if (successCallback) {
            successCallback(_retrive());
        }

        utils.forEach(_data.observers, function (observer) {
            observer.onchanged(historyEntry);
        });
    };
    this.addListener = function (observerObj) {
        var handle = Math.uuid(null, 16);

        if (!_security.all && !_security.history && !_security.addListener) {
            throw new WebAPIError(errorcode.SECURITY_ERR);
        }

        if ((observerObj === null || observerObj === undefined) || !observerObj.hasOwnProperty("onadded") ||
            !observerObj.hasOwnProperty("onchanged")) {
            throw new WebAPIError(errorcode.TYPE_MISMATCH_ERR);
        }

        if (typeof observerObj.onadded !== "function" || typeof observerObj.onchanged !== "function") {
            throw new WebAPIError(errorcode.TYPE_MISMATCH_ERR);
        }

        _data.observers[handle] = observerObj;

        return handle;
    };
    this.removeListener = function (handle) {
        if (!_security.all && !_security.history && !_security.removeListener) {
            throw new WebAPIError(errorcode.SECURITY_ERR);
        }

        if (_data.observers[handle]) {
            delete _data.observers[handle];
        }
        else {
            throw new WebAPIError(errorcode.INVALID_VALUES_ERR);
        }
    };
}

function _initialize() {
    _data.callServices.push(new CallService("TelVoice1", "tizen.tel", "VTMobile", ["call.voice", "call.video"]));
    _data.callServices.push(new CallService("TelEmergency1", "tizen.xmpp", "VTUnicom", ["call.voice", "call.emergency"]));
    _data.callServices.push(new CallService("Telephone1", "tizen.sip", "VTComm", ["call"]));

    _history = new CallHistory();
    _retrive();

    event.on("CallInProgress", function (isInProgress) {
        _data.isCallInProgress = isInProgress;
    });

    event.on("CallRecorded", function (record) {
        var callService = _data.callServices[_currentServiceIndex],
            historyEntry = _getCallHistoryEntry(record.serviceId, callService.serviceTypeId, callService.tags,
                               record.callParticipants, record.forwardedFrom, record.startTime, record.duration, 
                               record.endReason, record.direction, record.recording, 0, null);

        _data.callHistory.push(historyEntry);
        _save();

        utils.forEach(_data.observers, function (observer) {
            observer.onadded([historyEntry]);
        });
    });
}

_self = {
    history: undefined,
    isCallInProgress: function () {
        if (!_security.all && !_security.isCallInProgress) {
            throw new WebAPIError(errorcode.SECURITY_ERR);
        }

        return _data.isCallInProgress;
    },
    getCallServices: function (filter) {
        if (!_security.all && !_security.getCallServices) {
            throw new WebAPIError(errorcode.SECURITY_ERR);
        }

        if (!_isCallServiceFilterType(filter)) {
            throw new WebAPIError(errorcode.TYPE_MISMATCH_ERR);
        }

        _data.callServices = _data.callServices.filter(function (element) {
            var flag = true;
            utils.forEach(filter, function (value, key) {
                if (!tizen1_utils.isEqual(element[key], value)) {
                    flag = false;
                }
            });

            return flag;
        });

        return _data.callServices;
    },
    handleSubFeatures: function (subFeatures) {
        function setSecurity(_security) {
            return function (method) {
                _security[method] = true;
            };
        }

        for (var subFeature in subFeatures) {
            if (_security[subFeature].length === 0) {
                _security.all = true;
                return;
            }
            _security.all = false;
            utils.forEach(_security[subFeature], setSecurity);
        }
    }
};

_self.__defineGetter__("history", function () {
    return _history;
});

_initialize();

module.exports = _self;
