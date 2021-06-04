/*global $,Blob,atob,btoa,toastr*/
/*jslint browser,long*/

(function () {

    "use strict";

    var backward = function (parameters) {
        var anchor = $(".breadcrumb-item a").last();

        if (parameters) {
            anchor.attr("href", anchor.attr("href") + "?" + atob(parameters));
        }

        anchor.click();
    };

    var build = function (href, extra, excludes) {
        var data = parse(href);
        var parameters = [];

        $.each($.extend(data.parameters, extra), function (name, value) {
            if (!excludes || excludes.indexOf(name) < 0) {
                parameters.push(name + "=" + encodeURIComponent(value));
            }
        });

        if (parameters.length) {
            return data.url + "?" + parameters.join("&");
        } else {
            return data.url;
        }
    };

    var combine = function (data, name, value) {
        if (empty(value)) {
            value = null;
        }

        if (data.hasOwnProperty(name)) {
            var current = data[name];

            if (Array.isArray(current)) {
                current.push(value);
            } else {
                data[name] = [current, value];
            }
        } else {
            data[name] = value;
        }
    };

    var destroy = function (target) {
        target.find("div[data-format=color]").each(function (ignore, element) {
            $(element).data("colorpicker").destroy();
        });

        target.find("input[data-format=date],input[data-format=datetime]").each(function (ignore, element) {
            $(element).data("daterangepicker").remove();
        });

        if ($.fn.select2) {
            target.find("select.select2bs4").select2("destroy");
        }

        if ($.fn.summernote) {
            target.find("textarea[data-format=html]").summernote("destroy");
        }

        if ($.fn.floatingScroll) {
            target.find(".table-responsive").floatingScroll("destroy");
        }

        target.hide().empty();
    };

    var download = function (response) {
        var anchor;
        var file;
        var raw = atob(response.content);
        var size = raw.length;
        var data = new Array(size);

        while (size) {
            size -= 1;
            data[size] = raw.charCodeAt(size);
        }

        file = new Blob([new Uint8Array(data)], {type: response.contentType});

        anchor = document.getElementById("download-anchor");
        anchor.download = response.filename;
        anchor.href = URL.createObjectURL(file);
        anchor.click();

        URL.revokeObjectURL(anchor.href);
    };

    var empty = function (value) {
        if (value) {
            return false;
        }

        return value === "" || value === null || value === undefined;
    };

    var encode = function (text) {
        return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/\=/g, "");
    };

    var error = function (response) {
        switch (response.status) {
        case 401:
            location.reload();
            return;
        default:
            toastr.error(response.statusText);
        }

        overlay.hide();
    };

    var execute = function (script) {
        $.globalEval("(function () {" + script + "}());");
    };

    var overlay = (function () {
        var overlays = 0;
        var wrapper = $(".overlay-wrapper");

        return {
            hide: function () {
                overlays -= 1;

                if (!overlays) {
                    wrapper.hide();
                }
            },
            show: function () {
                if (!overlays) {
                    wrapper.show();
                }

                overlays += 1;
            }
        };
    }());

    var parse = function (href) {
        var parameters = {};
        var url;

        $.each(href.split(/[?&]/), function (index, text) {
            if (index) {
                index = text.indexOf("=");

                if (index < 0) {
                    parameters[text] = "";
                } else {
                    parameters[text.substring(0, index)] = decodeURIComponent(text.substring(index + 1));
                }
            } else {
                url = text;
            }
        });

        return {parameters, url};
    };

    var perform = function (path, parameters, options) {
        overlay.show();

        if (empty(path)) {
            path = settings.overview;
        }

        if (!$.isPlainObject(parameters)) {
            parameters = serialize(parameters);
        }

        if (options && options.parameters) {
            $.extend(parameters, options.parameters);
        }

        $.ajax({
            contentType: "application/json",
            data: JSON.stringify(parameters),
            error,
            success: function (data) {
                success(data, parameters);
            },
            type: "POST",
            url: path
        });
    };

    var processJson = function (response, parameters) {
        var parameters;
        var target;

        switch (response.type) {
        case "backward":
            backward(response.backward);
            break;
        case "download":
            download(response);
            break;
        case "insert-images":
            $.each(response.paths, function (ignore, path) {
                $(response.target).summernote("insertImage", path);
            });
            break;
        case "location":
            location.href = response.path;
            break;
        case "message":
            toastr.info(response.message);
            break;
        case "open":
            window.open(response.path);
            break;
        case "redirect":
            if (response.message) {
                toastr.info(response.message);
            }
            redirect({path: response.path});
            break;
        case "refresh":
            if (response.message) {
                toastr.info(response.message);
            }
            if (response.modal) {
                $(".modal-wrapper .modal").modal("hide");
                parameters = {d: encode(encodeURIComponent(JSON.stringify(serialize(".form-wrapper"))))};
            }
            perform(history.state.path, parameters || {});
            break;
        case "reload":
            location.reload();
            break;
        case "validation":
            target = $(parameters["form-id"]);
            $.each(response.errors, function (ignore, error) {
                $(".invalid-feedback[data-name='" + error.name + "']", target).text(error.message).show();
            });
            break;
        default:
            if (response.error) {
                toastr.error(response.message || response.error);
            }
        }
    };

    var processXml = function (ignore, response) {
        var data = $(response);
        var expression = data.children("target").text().trim();
        var target;

        if (expression) {
            target = $(expression);
        }

        if (!expression || target.length === 1) {
            execute(data.children("preprocess").text());

            if (target) {
                destroy(target);

                target.html(data.children("html").text().trim()).show();
            }

            execute(data.children("postprocess").text());
        }
    };

    var redirect = function (state, replace, parameters) {
        if (replace) {
            history.replaceState(state, "", state.path);
        } else {
            state.referer = history.state.path;

            history.pushState(state, "", state.path);
        }

        perform(state.path, parameters || {});
    };

    var saveMenu = function () {
        var menus = [];

        $("a[data-branch]").each(function (ignore, element) {
            var node = $(element);

            if (node.parent().hasClass("menu-open")) {
                menus.push(node.data("branch"));
            }
        });

        localStorage.EXPANDED_MENUS = JSON.stringify(menus);
    };

    var serialize = function (expression) {
        var data = {};
        var form = $(expression);

        form.find("input,select,textarea").each(function (ignore, element) {
            var input;

            if (element.name) {
                switch (element.type) {
                case "checkbox":
                    if (!element.checked) {
                        combine(data, element.name, null);
                        return;
                    }
                    break;

                case "radio":
                    if (!element.checked) {
                        return;
                    }
                    break;

                case "select-multiple":
                    combine(data, element.name, $(element).val());
                    return;

                case "textarea":
                    input = $(element);
                    if (input.is("[data-format=html]") && input.summernote("isEmpty")) {
                        combine(data, element.name, null);
                    } else {
                        combine(data, element.name, input.val());
                    }
                    return;
                }

                combine(data, element.name, element.value);
            }
        });

        if (form.is("table") || form.hasClass("editable-list")) {
            var list = {};

            $.each(Object.keys(data), function (ignore, name) {
                var tokens = name.split("@");

                if (tokens.length === 2) {
                    var id = tokens[1];

                    if (!list[id]) {
                        list[id] = {id};
                    }

                    list[id][tokens[0]] = data[name];

                    delete data[name];
                }
            });

            data.list = list;
        }

        return data;
    };

    var settings = $.extend({overview: "overview"}, $("script:last").data());

    var success = function (data, parameters) {
        if ($.isPlainObject(data)) {
            processJson(data, parameters);
        } else {
            $("response", data).each(processXml);
        }

        setTimeout(overlay.hide);
    };

    var toggleControls = function (checked) {
        var list = [];

        checked.each(function (ignore, input) {
            list.push($(input).data("id"));
        });

        $("button[data-least]").data("args", list).each(function (ignore, element) {
            var button = $(element);

            button.prop("disabled", list.length < button.data("least"));
        });
    };

    window.editLabel = function (name) {
        perform("text", {name});
    };

    window.initForm = function (form) {
        form.find("div[data-format=color]").each(function (ignore, element) {
            var target = $(element);
            var input = target.find("input");
            var output = target.find(".input-group-text");

            target.colorpicker().on("colorpickerChange", function (event) {
                var color = "";

                if (event.color) {
                    color = event.color.toString();
                }

                output.css("background-color", color);
            });

            output.css("background-color", input.val());
        });

        form.find("input[data-format=date],input[data-format=datetime]").each(function (ignore, element) {
            var input = $(element);

            input.daterangepicker({
                autoUpdateInput: false,
                locale: {format: input.data("pattern")},
                showDropdowns: true,
                singleDatePicker: true,
                timePicker: input.data("format").indexOf("time") >= 0,
                timePicker24Hour: true,
                timePickerSeconds: true
            }).on("apply.daterangepicker", function (event, picker) {
                $(event.currentTarget).val(picker.startDate.format(input.data("pattern")));
            });
        });

        form.find("input[data-format=file]").on("change", function (event) {
            var file = event.currentTarget.files && event.currentTarget.files[0];
            var input = $(event.currentTarget).siblings("input[data-file]");

            if (file) {
                var reader = new FileReader();

                reader.onload = function () {
                    var preview;

                    if (file.type.startsWith("image/")) {
                        preview = "<img class=\"border shadow\" src=\"" + reader.result + "\">";
                    } else {
                        preview = "<span><a class=\"btn btn-default p-3\">" + file.name + "</a></span>";
                    }

                    input.val(reader.result);
                    input.siblings("input[data-filename]").val(file.name);
                    input.closest("div").find(".file-preview").html(preview);
                    input.closest("div").siblings(".invalid-feedback").hide().empty();
                };

                reader.readAsDataURL(file);
            }
        });

        form.find("input[data-format=image]").on("change", function (event) {
            var file = event.currentTarget.files && event.currentTarget.files[0];
            var input = $(event.currentTarget).siblings("input[data-image]");
            var feedback = input.closest("div").siblings(".invalid-feedback").hide().empty();

            if (file) {
                if (file.type.startsWith("image/")) {
                    var reader = new FileReader();

                    reader.onload = function () {
                        input.val(reader.result);
                        input.siblings("input[data-filename]").val(file.name);
                        input.closest("div").find(".file-preview").html("<img class=\"border shadow\" src=\"" + reader.result + "\">");
                        input.parent().siblings("a[data-remove]").removeClass("d-none");
                    };

                    reader.readAsDataURL(file);

                    return;
                }

                feedback.text(input.data("error")).show();
            }
        });

        form.find("input[data-format=images]").on("change", function (event) {
            var files = event.currentTarget.files;

            if (files && files.length) {
                var input = $(event.currentTarget);
                var name = input.data("name");

                $.each(files, function (ignore, file) {
                    if (file.type.startsWith("image/")) {
                        var reader = new FileReader();

                        reader.onload = function () {
                            var container = $("<div class=\"img-wrapper\"><button class=\"close\" data-remove><span>&times;</span></button></div>");

                            $("<input name=\"" + name + "\" type=\"hidden\">").val(reader.result).appendTo(container);
                            $("<input name=\"" + name + "#filename\" type=\"hidden\">").val(file.name).appendTo(container);
                            $("<img class=\"border shadow\">").attr("src", reader.result).appendTo(container);

                            input.closest("div").find(".file-preview").append(container);
                        };

                        reader.readAsDataURL(file);
                    }
                });
            }
        });

        if ($.fn.select2) {
            form.find("select.select2bs4").select2({
                theme: "bootstrap4"
            }).filter("[data-search]").on("change", function (event) {
                var select = $(event.currentTarget);
                var inputs = select.closest("[id]").find("[data-name]");

                inputs.filter(":visible").addClass("d-none").find("input,select").val("").filter("select").trigger("change");
                inputs.filter("[data-name='" + select.val() + "']").removeClass("d-none");
            });
        }

        if ($.fn.summernote) {
            form.find("textarea[data-format=html]").each(function (ignore, element) {
                var editor = $(element);
                var config = {height: 300};

                if (editor.is("[data-disabled]")) {
                    config.toolbar = [];

                    editor.summernote(config).summernote("disable");
                } else {
                    config.callbacks = {
                        onImageUpload: function (files) {
                            var images = [];

                            $.each(files, function (index, file) {
                                var reader = new FileReader();

                                reader.onload = function () {
                                    images[index] = {file: reader.result, "file#filename": file.name};

                                    if (images.length === files.length) {
                                        perform("file/upload-images", {
                                            images,
                                            target: "#" + form.attr("id") + " textarea[name='" + editor.attr("name") + "']"
                                        });
                                    }
                                };

                                reader.readAsDataURL(file);
                            });
                        }
                    };

                    editor.summernote(config);
                }
            });
        }
    };

    window.onpopstate = function (event) {
        $(".ekko-lightbox, .modal-wrapper .modal").modal("hide");

        perform(event.state.path, {});
    };

    window.perform = perform;

    window.toggleMenu = function (name) {
        var menu;

        name = name || $(".breadcrumb-item[data-menu]").first().data("menu");
        menu = $("a[data-leaf][href='" + name + "']").blur();

        $("a.active[data-leaf]").removeClass("active");

        menu.addClass("active").parents(".has-treeview").addClass("menu-open").children("ul").css("display", "block");

        saveMenu();

        $("body.sidebar-open").toggleClass("sidebar-collapse sidebar-open");
    };

    $("button[data-language]").click(function (event) {
        location.href = $(event.currentTarget).data("path") + location.href.substring(document.baseURI.length);
    });

    $(document).delegate("a[data-ajax]", "click", function (event) {
        var anchor = $(event.currentTarget);
        var modal = anchor.closest(".modal");
        var path = anchor.attr("href");

        if (modal.length) {
            modal.one("hidden.bs.modal", function () {
                redirect({path});
            }).modal("hide");
        } else if (path === history.state.path) {
            perform(path, {});
        } else if (path === history.state.referer) {
            history.back();
        } else {
            redirect({path});
        }

        return false;
    }).delegate("a[data-remove]", "click", function (event) {
        var anchor = $(event.currentTarget);

        anchor.addClass("d-none");
        anchor.siblings(".file-preview").empty();
        anchor.siblings("label").find("input").each(function (ignore, element) {
            $(element).val("");
        });
    }).delegate("a[data-toggle=lightbox]", "click", function (event) {
        $(event.currentTarget).ekkoLightbox();

        return false;
    }).delegate("button[data-ajax]", "click", function (event) {
        var button = $(event.currentTarget);
        var form = button.data("form");
        var options;

        if (form) {
            $(".invalid-feedback", form).hide().empty();
            options = {parameters: {"form-id": form}};
        } else {
            form = {args: button.data("args")};
        }

        perform(button.data("ajax"), form, options);
    }).delegate("button[data-backward]", "click", function (event) {
        backward($(event.currentTarget).data("backward"));
    }).delegate("button[data-remove]", "click", function (event) {
        $(event.currentTarget).closest("div").remove();
    }).delegate("button[data-search]", "click", function (event) {
        var form = $(event.currentTarget).data("form");
        var data = serialize(form);
        var path = history.state.path;
        var search = {};

        $.each(Object.keys(data), function (ignore, name) {
            var value = $.trim(data[name]);

            if (value) {
                search[name] = encodeURIComponent(value);
            }
        });

        if (Object.keys(search).length) {
            path = build(path, {q: encode(JSON.stringify(search))}, ["p"]);
        } else {
            path = build(path, {}, ["p", "q"]);
        }

        redirect({path}, false, {"form-id": form});
    }).delegate("button[data-upload]", "click", function (event) {
        var input = $(event.currentTarget).siblings("input");

        if (!input.data("binding")) {
            input.on("change", function () {
                var file = input[0].files && input[0].files[0];

                if (file) {
                    var reader = new FileReader();

                    reader.onload = function () {
                        perform(input.data("ajax"), {file: reader.result, "file#filename": file.name});

                        input.val("");
                    };

                    reader.readAsDataURL(file);
                }
            });

            input.data("binding", true);
        }

        input.click();
    }).delegate("input[data-all][type=checkbox]", "change", function (event) {
        var list = $("input[data-id][type=checkbox]");

        list.prop("checked", $(event.currentTarget).prop("checked"));

        toggleControls(list.filter(":checked"));
    }).delegate("input[data-id][type=checkbox]", "change", function () {
        var list = $("input[data-id][type=checkbox]");
        var checked = list.filter(":checked");

        $("input[data-all][type=checkbox]").prop("checked", list.length === checked.length);

        toggleControls(checked);
    }).delegate("select[data-reaction]", "change", function (event) {
        var parameters = {};
        var select = $(event.currentTarget);
        parameters[select.attr("name")] = select.val();
        perform(select.data("reaction"), parameters);
    }).delegate("select[name=p]", "change", function (event) {
        redirect({path: build(history.state.path, {p: $(event.currentTarget).val()})});
    }).ready(function () {
        $("ul[data-widget=treeview]").on("collapsed.lte.treeview expanded.lte.treeview", saveMenu);

        if (localStorage.EXPANDED_MENUS) {
            $.each(JSON.parse(localStorage.EXPANDED_MENUS), function (ignore, menu) {
                $("a[data-branch='" + menu + "']").parent().addClass("menu-open").children("ul").css("display", "block");
            });
        }

        if (history.state) {
            perform(history.state.path, {});
        } else {
            redirect({path: settings.path + location.search}, true);
        }
    });

}());
