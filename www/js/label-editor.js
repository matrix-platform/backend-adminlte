/*global $*/
/*jslint browser,long*/

(function () {

    let active = false;

    let count = 0;

    let edit = function (event) {
        if (window.editLabel) {
            window.editLabel($(event.currentTarget).data("edit"));
        }

        return false;
    };

    let restore = function (ignore, element) {
        let node = $(element);

        if (!node.data("length")) {
            node.empty();
        }

        node.off("click", edit).removeClass("editable-label");
    };

    let setup = function (ignore, element) {
        let node = $(element);
        let length = node.html().length;

        if (!length) {
            node.text("{" + node.data("edit") + "}");
        }

        node.addClass("editable-label").data("length", length).on("click", edit);
    };

    let toggle = function () {
        let elements = $("[data-edit]");

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
