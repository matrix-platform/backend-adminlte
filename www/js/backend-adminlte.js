/*global $,Blob,Sortable,atob,btoa,history,toastr*/
/*jslint browser,long*/

(function () {

    "use strict";

    var attachment = function (event) {
        var files = event.currentTarget.files;
        var name;
        var picker;
        var suffix;

        if (files && files.length) {
            picker = $(event.currentTarget).siblings(".attachment-picker");
            name = picker.data("name");
            suffix = picker.data("suffix");

            $.each(files, function (ignore, file) {
                var reader = new FileReader();

                reader.onload = function () {
                    var filename = file.name.replace(/"/g, "&quot;");

                    overlay.hide();

                    if (picker.hasClass("picture-picker")) {
                        picker.before([
                            `<div class="attachment-wrapper picture-wrapper rounded">`,
                            `<div class="picture-preview">`,
                            `<a data-toggle="lightbox" href="${reader.result}"><img alt="${filename}" src="${reader.result}"></a>`,
                            `</div>`,
                            `<div class="picture-controller">`,
                            `<div class="btn-group w-100">`,
                            `<button class="btn btn-default btn-flat border-0" disabled><i class="fas fa-cloud-download-alt"></i></button>`,
                            `<button class="btn btn-default btn-flat border-0" disabled><i class="fas fa-info"></i></button>`,
                            `<button class="btn btn-default btn-flat border-0" data-remove-attachment><i class="fas fa-trash-alt"></i></button>`,
                            `</div>`,
                            `</div>`,
                            `<input name="${name}${suffix}" type="hidden" value="${reader.result}">`,
                            `<input name="${name}#filename${suffix}" type="hidden" value="${filename}">`,
                            `</div>`
                        ].join(""));
                    } else {
                        picker.before([
                            `<div class="attachment-wrapper file-wrapper list-group-item">`,
                            `<a download="${filename}" href="${reader.result}">`,
                            filename.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"),
                            `</a>`,
                            `<div class="btn-group">`,
                            `<button class="btn btn-default btn-flat border-0" disabled><i class="fas fa-info"></i></button>`,
                            `<button class="btn btn-default btn-flat border-0" data-remove-attachment><i class="fas fa-trash-alt"></i></button>`,
                            `</div>`,
                            `<input name="${name}${suffix}" type="hidden" value="${reader.result}">`,
                            `<input name="${name}#filename${suffix}" type="hidden" value="${filename}">`,
                            `</div>`
                        ].join(""));
                    }
                };

                reader.readAsDataURL(file);

                overlay.show();
            });

            picker.siblings("input[type=hidden]").remove();

            if (!picker.siblings("[type=file]").val("").is("[multiple]")) {
                picker.addClass("d-none");
            }
        }
    };

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
        var current;

        if (empty(value)) {
            value = null;
        }

        if (data.hasOwnProperty(name)) {
            current = data[name];

            if (Array.isArray(current)) {
                current.push(value);
            } else {
                data[name] = [current, value];
            }
        } else {
            data[name] = value;
        }
    };

    var complete = function (options) {
        if (options.overlay !== false) {
            setTimeout(overlay.hide);
        }
    };

    var destroy = function (target) {
        target.find("div.attachment-container, div.options-checked").each(function (ignore, element) {
            Sortable.get(element).destroy();
        });

        target.find("div[data-format=color]").each(function (ignore, element) {
            $(element).data("colorpicker").destroy();
        });

        target.find("div[data-format=time]").each(function (ignore, element) {
            $(element).datetimepicker("destroy");
        });

        target.find("input[data-format=date],input[data-format=datetime]").each(function (ignore, element) {
            $(element).data("daterangepicker").remove();
        });

        if ($.fn.select2) {
            target.find("select.select2bs4").select2("destroy");
        }

        if ($.fn.summernote) {
            target.find("textarea[data-format=html]").each(function (ignore, element) {
                var editor = $(element);

                if (editor.summernote("fullscreen.isFullscreen")) {
                    editor.summernote("fullscreen.toggle");
                }

                editor.summernote("destroy");
            });
        }

        if ($.fn.floatingScroll) {
            target.find(".table-responsive").floatingScroll("destroy");
        }

        if (window.CKEDITOR) {
            target.find("textarea[data-format=html]").each(function (ignore, element) {
                $(element).ckeditorGet().destroy();
            });
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

    var perform = function (path, parameters, options = {}) {
        if (options.overlay !== false) {
            overlay.show();
        }

        if (empty(path)) {
            path = settings.overview;
        }

        if (!$.isPlainObject(parameters)) {
            parameters = serialize(parameters);
        }

        if (options.parameters) {
            $.extend(parameters, options.parameters);
        }

        return $.ajax({
            complete() {
                complete(options);
            },
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

    var processJson = function (response, request) {
        var parameters;
        var target;

        switch (response.type) {
        case "backward":
            if (response.message) {
                toastr.info(response.message);
            }
            backward(response.backward);
            break;
        case "download":
            download(response);
            break;
        case "file-info":
            toastr.info(response.message);
            $(".modal-wrapper .modal").modal("hide");
            $(`button[data-ajax="file-info/${response.id}"]`).each(function (ignore, element) {
                var wrapper = $(element).closest(".attachment-wrapper");
                if (wrapper.hasClass("picture-wrapper")) {
                    wrapper.find("a[data-toggle]").attr("title", response.description);
                    wrapper.find("a[download]").attr("download", response.name).attr("title", response.name);
                    wrapper.find("img").attr("alt", response.name);
                } else {
                    wrapper.find("a").attr("download", response.name).attr("title", response.description).text(response.name);
                }
            });
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
            $(".modal-wrapper .modal").modal("hide");
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
            target = $(request["form-id"]);
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
        var list;

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
                    if ($.fn.summernote && input.is("[data-format=html]") && input.summernote("isEmpty")) {
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
            list = {};

            $.each(Object.keys(data), function (ignore, name) {
                var id;
                var tokens = name.split("@");

                if (tokens.length === 2) {
                    id = tokens[1];

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

    var sortableAttachment = function (ignore, element) {
        Sortable.create(element, {
            animation: 200,
            filter: "button",
            onMove(event) {
                return event.related.classList.contains("attachment-wrapper");
            }
        });
    };

    var sortableOptions = function (ignore, element) {
        var unchecked = $(element);
        var checked = unchecked.prev("div.options-checked");

        unchecked.delegate("div", "click", function (event) {
            var option = $(event.currentTarget);

            option.append(`<input name="${unchecked.data("inputName")}" type="hidden" value="${option.data("inputValue")}">`);
            option.appendTo(checked.children("input").remove().end());
        });

        checked.delegate("i", "click", function (event) {
            $(event.currentTarget).parent().find("input").remove().end().appendTo(unchecked);

            if (!checked.children().length) {
                checked.append(`<input name="${unchecked.data("inputName")}" type="hidden" value="">`);
            }
        });

        Sortable.create(checked[0], {animation: 150});
    };

    var success = function (data, parameters) {
        if ($.isPlainObject(data)) {
            processJson(data, parameters);
        } else {
            $("response", data).each(processXml);
        }
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

    toastr.options = {
        onclick(event) {
            event.clickToClose = true;
        },
        progressBar: true,
        timeOut: 3000
    };

    window.destroyForm = destroy;

    window.editLabel = function (name) {
        perform("label", {name});
    };

    window.initForm = function (form) {
        form.find("div.attachment-container").each(sortableAttachment);

        form.find("div.options-unchecked").each(sortableOptions);

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

        form.find("div[data-format=time]").each(function (ignore, element) {
            var target = $(element);

            target.datetimepicker({
                format: target.data("pattern")
            });
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

        form.find("input[data-format=attachment]").on("change", attachment);

        form.find("textarea[rows]").each(function (ignore, element) {
            element.style.height = (element.scrollHeight + 10) + "px";
        });

        if ($.fn.select2) {
            form.find("select.select2bs4").each(function (ignore, element) {
                var select = $(element);
                var options = {theme: "bootstrap4"};

                if (!select.is("[data-searchable]")) {
                    options.minimumResultsForSearch = Infinity;
                }

                if (select.is("[data-cascade]") || select.is("[data-search]")) {
                    options.dropdownAutoWidth = true;
                } else {
                    select.css("width", "100%");
                }

                select.select2(options);
            }).filter("[data-cascade]").each(function (ignore, element) {
                var select = $(element);
                var target = $(`select[name="${select.data("cascade")}"]`);
                var options = target.find("[data-parent-id]");

                select.on("change", function () {
                    var selected = target.val();
                    var removed = options.prop("selected", false).filter(`[data-parent-id!="${select.val()}"]`).remove();

                    options.not(removed).appendTo(target).filter(`[value="${selected}"]`).prop("selected", true);
                    target.trigger("change");
                }).change();
            }).end().filter("[data-search]").on("change", function (event) {
                var select = $(event.currentTarget);
                var inputs = select.closest("[id]").find("[data-name]");

                inputs.filter(":visible").addClass("d-none");
                inputs.find("input").val("");
                inputs.find("option:selected").prop("selected", false).closest("select").trigger("change");
                inputs.filter("[data-name='" + select.val() + "']").removeClass("d-none");
            });
        }

        if ($.fn.summernote) {
            form.find("textarea[data-format=html]").each(function (ignore, element) {
                var editor = $(element);
                var config = {height: 300, placeholder: editor.data("placeholder")};

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

        if (window.CKEDITOR) {
            form.find("textarea[data-format=html]").each(function (ignore, element) {
                var editor = $(element);

                editor.ckeditor({
                    allowedContent: true,
                    baseHref: document.baseURI.match(/^(.*)(backend\/)$/)[1],
                    bodyClass: editor.data("editorClass") || "ckeditor-body",
                    contentsCss: "css/ckeditor.css",
                    enterMode: window.CKEDITOR.ENTER_BR,
                    filebrowserImageUploadUrl: "file/upload-file",
                    shiftEnterMode: window.CKEDITOR.ENTER_P,
                    uploadUrl: "file/upload-file"
                });
            });
        }
    };

    window.onpopstate = function (event) {
        $("a.cke_button__maximize.cke_button_on").click();
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
    }).delegate("a[data-toggle=lightbox]", "click", function (event) {
        $(event.currentTarget).ekkoLightbox();

        return false;
    }).delegate("button.attachment-picker", "click", function (event) {
        $(event.currentTarget).siblings("input[type=file]").click();
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
    }).delegate("button[data-remove-attachment]", "click", function (event) {
        var file = $(event.currentTarget).closest(".attachment-wrapper");
        var name;
        var picker = file.siblings(".attachment-picker").removeClass("d-none");
        var suffix;

        file.remove();

        if (!picker.siblings(".attachment-wrapper").length) {
            name = picker.data("name");
            suffix = picker.data("suffix");

            picker.after(`<input name="${name}${suffix}" type="hidden"><input name="${name}#filename${suffix}" type="hidden">`);
        }
    }).delegate("button[data-search]", "click", function (event) {
        var form = $(event.currentTarget).data("form");
        var data = serialize(form);
        var path = history.state.path;
        var search = {};

        $.each(Object.keys(data), function (ignore, name) {
            var value = data[name];

            if (Array.isArray(value)) {
                if (value.length) {
                    search[name] = value.map(encodeURIComponent);
                }
            } else {
                value = $.trim(value);

                if (value) {
                    search[name] = encodeURIComponent(value);
                }
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
                var reader;

                if (file) {
                    reader = new FileReader();

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
        var checkbox = $(event.currentTarget);
        var list = $(`input[data-group="${checkbox.data("group")}"][data-id][type=checkbox]`);

        list.prop("checked", checkbox.prop("checked"));

        toggleControls(list.filter(":checked"));
    }).delegate("input[data-id][type=checkbox]", "change", function (event) {
        var group = $(event.currentTarget).data("group");
        var list = $(`input[data-group="${group}"][data-id][type=checkbox]`);
        var checked = list.filter(":checked");

        $(`input[data-all][data-group="${group}"][type=checkbox]`).prop("checked", list.length === checked.length);

        toggleControls(checked);
    }).delegate("input[data-switch][type=checkbox]", "change", function (event) {
        var checkbox = $(event.currentTarget).prop("disabled", true);
        var value = checkbox.prop("checked");
        perform(`set-${checkbox.data("switch")}`, {id: checkbox.attr("id"), value}, {overlay: false}).fail(function () {
            checkbox.prop("checked", !value);
        }).always(function () {
            checkbox.prop("disabled", false);
        });
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
