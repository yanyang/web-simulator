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
var utils = require('ripple/utils'),
    constants = require('ripple/constants'),
    _platform = require('ripple/platform'),
    db = require('ripple/db'),
    _applicationStateId
    ;


function reload() {
    location.reload();
}

function _showSettingMenu() {
    var contentTable = "",
    settings = [],
    _applicationState = [],
    _applicationStateTmp = [],
    i = 0;

    if ($("#settings-menu-popup").is(":visible")) {
        $("#settings-menu-popup").hide("slide", {direction: "up"},"slow");
        $("#overlayBackground").hide("fade", "slow");
        return;
    }

    _applicationStateId = constants.COMMON.APPLICATION_STATE +
        ((db.retrieveObject(constants.PLATFORM.SAVED_KEY) || constants.PLATFORM.DEFAULT)).name;

    _applicationStateTmp = db.retrieveObject(_applicationStateId) || [];

    utils.forEach(_applicationStateTmp, function (obj) {
        if (obj.display)
            _applicationState.push(obj);
    });

    utils.forEach(_applicationStateTmp, function (obj) {
        if (!obj.display)
            _applicationState.push(obj);
    });

    $("#settings-menu-content-panel-table").remove();

    contentTable = '<table id="settings-menu-content-panel-table" class="settings-menu-content-table">';
    utils.forEach(_applicationState, function (obj) {
        var checked = obj.display ? 'checked="yes"':"";
        contentTable += '<tr><td><input name="panel-display-setting" type="checkbox" class="settings-menu-checkbox "'+
                        checked +'></input>'+
                        obj.titleName+'</td></tr>\n';
    });
    contentTable += "</table>";

    $("#settings-menu-container-div").append(contentTable);
    $("#settings-menu-popup").css( "top" , 50  );
    $("#settings-menu-popup").css( "left" , $(window).width() - 340  );

    $("#overlayBackground").css("width", $(window).width());
    $("#overlayBackground").css("height", $(window).height());
    $("#overlayBackground").show("fade", "slow");
    $("#settings-menu-popup").show("slide", {direction: "up"}, "slow");

    $("#settings-menu-save-btn").unbind('click');
    $("#settings-menu-save-btn").bind("click", function (event) {
        $("input[name='panel-display-setting']").each(function (i, a) {
            settings.push(a.checked);
        });

        utils.forEach(_applicationState, function (obj) {
            if (!settings[i])
                obj.collapsed = true;
            obj.display = settings[i];
            i++
        }, this);
  
        db.saveObject(_applicationStateId, _applicationState);
        _applicationStateTmp = db.retrieveObject(_applicationStateId) || [];

        $("#settings-menu-popup").hide("slide", {direction: "up"},"slow");
        $("#overlayBackground").hide("fade", "slow");
        setTimeout(reload, 500);
    });

    $(".settings-menu-content-table td").unbind('click');
    $(".settings-menu-content-table td").bind("click", function (event) {
        var checkbox;
        if (($(event.target).children().length == 0))
            return;
        else
            checkbox = $(event.target).children()
        
        if (checkbox.is(':checked')) {
            checkbox.prop('checked', false);
        }
        else
            checkbox.prop('checked', true);
    });

    $("#settings-menu-close-btn").unbind('click');
    $("#settings-menu-close-btn").bind("click", function (event) {
       if ($("#settings-menu-popup").is(":visible")) {
            $("#settings-menu-popup").hide("slide", {direction: "up"},"slow");
            $("#overlayBackground").hide("fade", "slow");
            return;
        }
    });

    $(window).unbind('resize');
    $(window).bind('resize', function() {
        $("#settings-menu-popup").css( "top" , 50);
        $("#settings-menu-popup").css( "left" , $(window).width() - 340);
        $("#overlayBackground").css("width", $(window).width());
        $("#overlayBackground").css("height", $(window).height());
    });
}

module.exports = {
    initialize: function () {
         $("#options-button-setting-menu").bind("click", function (event) {
            _showSettingMenu();
        });
    }
};
