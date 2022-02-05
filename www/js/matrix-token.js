/*global $*/
/*jslint browser,long*/

(function () {

    $(document).ajaxSend(function (ignore, request) {
        let token = [0, 0, 0, 0, 0, 0].map(() => Math.random().toString(36).substring(2)).join("");

        if (location.protocol === "https") {
            document.cookie = `matrix-token=${token}; path=/; samesite=strict; secure`;
        } else {
            document.cookie = `matrix-token=${token}; path=/`;
        }

        request.setRequestHeader("matrix-token", token);
    });

}());
