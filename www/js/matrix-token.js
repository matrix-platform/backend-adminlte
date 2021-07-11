/*global $*/
/*jslint browser,long*/

(function () {

    "use strict";

    $(document).ajaxSend(function (ignore, request) {
        var token = [0, 0, 0, 0, 0, 0].map(() => Math.random().toString(36).substring(2)).join("");

        document.cookie = `matrix-token=${token}; path=/; samesite=strict; secure`;

        request.setRequestHeader("matrix-token", token);
    });

}());
