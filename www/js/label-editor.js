/*global $*/
/*jslint browser,long*/

(function () {

    "use strict";

    var active = false;

    var count = 0;

    var edit = function (event) {
        if (window.editLabel) {
            window.editLabel($(event.currentTarget).data("edit"));
        }

        return false;
    };

    var restore = function (ignore, element) {
        var node = $(element);

        if (!node.data("length")) {
            node.empty();
        }

        node.off("click", edit).removeClass("editable-label");
    };

    var setup = function (ignore, element) {
        var node = $(element);
        var length = node.html().length;

        if (!length) {
            node.text("{" + node.data("edit") + "}");
        }

        node.addClass("editable-label").data("length", length).on("click", edit);
    };

    var toggle = function () {
        var elements = $("[data-edit]");

        active = !active;

        if (active) {
            elements.each(setup);
        } else {
            elements.each(restore);
        }
    };

    $(document).on("keyup", function (event) {
        if (event.which === 17) {
            count += 1;

            if (count !== 5) {
                return;
            }

            toggle();
        }

        count = 0;
    });

}());
