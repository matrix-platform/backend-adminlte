/*global $,Sortable,_,atob,btoa,google,history,i18n,toastr*/
/*jslint browser,long,nomen*/

(function () {

    let appendAttachment = function (picker, files) {
        let input = picker.siblings("[type=file]");
        let multiple = input.is("[multiple]");
        let name = picker.data("name");
        let suffix = picker.data("suffix");

        if (!multiple && files.length > 1) {
            files = [files[0]];
        }

        $.each(files, function (ignore, file) {
            if (file.size > settings.maxFileSize) {
                toastr.error(render(i18n.fileSize, {max: settings.maxFileSize, name: file.name, size: file.size}));
                return;
            }

            let filename = file.name.replace(/"/g, "&quot;");
            let url = URL.createObjectURL(file);

            resources[url] = {file, url};

            if (picker.hasClass("picture-picker")) {
                picker.before([
                    `<div class="attachment-wrapper new-attachment picture-wrapper">`,
                    `<div class="picture-preview">`,
                    `<a data-toggle="lightbox" data-type="image" href="${url}"><img alt="${filename}" src="${url}"></a>`,
                    `</div>`,
                    `<div class="picture-controller">`,
                    `<div class="btn-group w-100">`,
                    `<a class="btn btn-default btn-flat border-0" download="${filename}" href="${url}" title="${filename}"><i class="fas fa-cloud-download-alt"></i></a>`,
                    `<button class="btn btn-default btn-flat border-0" disabled><i class="fas fa-info"></i></button>`,
                    `<button class="btn btn-default btn-flat border-0" data-remove-attachment><i class="fas fa-trash-alt"></i></button>`,
                    `</div>`,
                    `</div>`,
                    `<input data-object-url name="${name}${suffix}" type="hidden" value="${url}">`,
                    `<input name="${name}#filename${suffix}" type="hidden" value="${filename}">`,
                    `</div>`
                ].join(""));
            } else {
                picker.before([
                    `<div class="attachment-wrapper file-wrapper list-group-item new-attachment">`,
                    `<a download="${filename}" href="${url}">`,
                    filename.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"),
                    `</a>`,
                    `<div class="btn-group">`,
                    `<button class="btn btn-default btn-flat border-0" disabled><i class="fas fa-info"></i></button>`,
                    `<button class="btn btn-default btn-flat border-0" data-remove-attachment><i class="fas fa-trash-alt"></i></button>`,
                    `</div>`,
                    `<input data-object-url name="${name}${suffix}" type="hidden" value="${url}">`,
                    `<input name="${name}#filename${suffix}" type="hidden" value="${filename}">`,
                    `</div>`
                ].join(""));
            }
        });

        input.val("");

        if (!picker.siblings(".attachment-wrapper").length) {
            return;
        }

        picker.siblings("input[type=hidden]").remove();

        if (!multiple) {
            picker.addClass("d-none");
        }
    };

    let attachment = function (event) {
        let files = event.currentTarget.files;

        if (files && files.length) {
            appendAttachment($(event.currentTarget).siblings(".attachment-picker"), files);
        }
    };

    let backward = function (parameters) {
        let anchor = $(".breadcrumb-item a").last();

        if (parameters) {
            anchor.attr("href", `${anchor.attr("href")}?${atob(parameters)}`);
        }

        anchor.click();
    };

    let build = function (href, extra, excludes) {
        let data = parse(href);
        let parameters = [];

        $.each($.extend(data.parameters, extra), function (name, value) {
            if (!excludes || excludes.indexOf(name) < 0) {
                parameters.push(`${name}=${encodeURIComponent(value)}`);
            }
        });

        if (parameters.length) {
            return `${data.url}?${parameters.join("&")}`;
        } else {
            return data.url;
        }
    };

    let combine = function (data, name, value) {
        if (empty(value)) {
            value = null;
        }

        if (data.hasOwnProperty(name)) {
            let current = data[name];

            if (Array.isArray(current)) {
                current.push(value);
            } else {
                data[name] = [current, value];
            }
        } else {
            data[name] = value;
        }
    };

    let compiled = {};

    let complete = function (options) {
        if (options.overlay !== false) {
            setTimeout(overlay.hide);
        }
    };

    let createMap = function (container, center) {
        if (!center) {
            center = new google.maps.LatLng(settings.latitude, settings.longitude);
        }

        let map = new google.maps.Map(container[0], {center, zoom: settings.map_zoom});
        let marker = new google.maps.Marker({draggable: !container.data("disabled"), map, position: center});

        marker.addListener("position_changed", function () {
            let position = marker.getPosition();

            $(`input[name="${container.data("latitude")}"]`).val(position.lat());
            $(`input[name="${container.data("longitude")}"]`).val(position.lng());
        });

        container.data("map", map).data("marker", marker).data("service", new google.maps.places.PlacesService(map));
    };

    let destroy = function (target) {
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

        target.find("input[data-object-url]").each(function (ignore, element) {
            URL.revokeObjectURL(element.value);

            delete resources[element.value];
        });

        if ($.fn.select2) {
            target.find("select.select2bs4").select2("destroy");
        }

        if ($.fn.summernote) {
            target.find("textarea[data-format=html]").each(function (ignore, element) {
                let editor = $(element);

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

    let download = function (response) {
        let raw = atob(response.content);
        let size = raw.length;
        let data = new Array(size);

        while (size) {
            size -= 1;
            data[size] = raw.charCodeAt(size);
        }

        let anchor = document.getElementById("download-anchor");
        let file = new Blob([new Uint8Array(data)], {type: response.contentType});

        anchor.download = response.filename;
        anchor.href = URL.createObjectURL(file);
        anchor.click();

        URL.revokeObjectURL(anchor.href);
    };

    let empty = function (value) {
        if (value) {
            return false;
        }

        return value === "" || value === null || value === undefined;
    };

    let encode = function (text) {
        return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/\=/g, "");
    };

    let error = function (response) {
        switch (response.status) {
        case 401:
            location.reload();
            return;
        default:
            toastr.error(response.statusText);
        }
    };

    let execute = function (script) {
        $.globalEval(`(function () {${script}}());`);
    };

    let initMap = function (ignore, element) {
        let container = $(element);
        let lat = $(`input[name="${container.data("latitude")}"]`).val();
        let lng = $(`input[name="${container.data("longitude")}"]`).val();

        if (!lat || !lng) {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(function (result) {
                    createMap(container, new google.maps.LatLng(result.coords.latitude, result.coords.longitude));
                }, function () {
                    createMap(container);
                });
            } else {
                createMap(container);
            }
        } else {
            createMap(container, new google.maps.LatLng(lat, lng));
        }
    };

    let overlay = (function () {
        let overlays = 0;
        let wrapper = $(".overlay-wrapper");
        let progress = wrapper.find(".upload-progress");

        return {
            hide() {
                overlays -= 1;

                if (!overlays) {
                    wrapper.hide();
                    progress.text("");
                }
            },
            progress(percent) {
                if (overlays) {
                    if (percent < 100 || progress.text()) {
                        progress.text(`${percent}%`);
                    }
                }
            },
            show() {
                if (!overlays) {
                    wrapper.show();
                }

                overlays += 1;
            }
        };
    }());

    let parse = function (href) {
        let parameters = {};
        let url;

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

    let perform = function (path, parameters, options = {}) {
        let form = options.form || new FormData();

        if (!$.isPlainObject(parameters)) {
            parameters = serialize(parameters);

            parameters.files.forEach(function (item) {
                form.append(item.url, item.file);
            });

            parameters = parameters.data;
        }

        if (options.parameters) {
            $.extend(parameters, options.parameters);
        }

        form.append("JSON", JSON.stringify(parameters));

        let count = 0;
        let size = 0;

        Array.from(form.values()).forEach(function (value) {
            if (typeof value === "string") {
                size += value.length;
            } else {
                count += 1;
                size += value.size;
            }
        });

        if (count > settings.maxFileCount) {
            toastr.error(render(i18n.fileCount, {count, max: settings.maxFileCount}));
            return;
        }

        if (size + 2048 > settings.maxPostSize) {
            toastr.error(render(i18n.postSize, {max: settings.maxPostSize, size: size + 2048}));
            return;
        }

        if (options.overlay !== false) {
            overlay.show();
        }

        if (empty(path)) {
            path = settings.overview;
        }

        return $.ajax({
            complete() {
                complete(options);
            },
            contentType: false,
            data: form,
            error,
            processData: false,
            success(data) {
                success(data, parameters);
            },
            type: "POST",
            url: path,
            xhr
        });
    };

    let processJson = function (response, request) {
        let target;

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
            $(".modal").last().modal("hide");
            $(`button[data-ajax="file-info/${response.id}"]`).each(function (ignore, element) {
                let wrapper = $(element).closest(".attachment-wrapper");
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
            $(".modal").modal("hide");
            redirect({path: response.path});
            break;
        case "refresh":
            if (response.message) {
                toastr.info(response.message);
            }
            if (response.modal) {
                $(".modal").modal("hide");
            }
            if (response.sublist) {
                perform($(".active.sublist").data("path"), {});
            } else {
                perform(history.state.path, {});
            }
            break;
        case "reload":
            location.reload();
            break;
        case "validation":
            target = $(request["form-id"]);
            $.each(response.errors, function (ignore, error) {
                $(`.invalid-feedback[data-name="${error.name}"]`, target).text(error.message).show();
            });
            break;
        default:
            if (response.error) {
                toastr.error(response.message || response.error);
            }
        }
    };

    let processXml = function (ignore, response) {
        let data = $(response);
        let expression = data.children("target").text().trim();
        let target;

        execute(data.children("preprocess").text());

        if (expression) {
            target = $(expression);
        }

        if (!expression || target.length === 1) {
            if (target) {
                destroy(target);

                target.html(data.children("html").text().trim()).show();
            }

            execute(data.children("postprocess").text());
        }
    };

    let redirect = function (state, replace, parameters) {
        if (replace) {
            history.replaceState(state, "", state.path);
        } else {
            state.referer = history.state.path;

            history.pushState(state, "", state.path);
        }

        perform(state.path, parameters || {});
    };

    let render = function (template, data) {
        if (!compiled[template]) {
            compiled[template] = _.template(template);
        }

        return compiled[template](data);
    };

    let resources = {};

    let saveMenu = function () {
        let menus = [];

        $("a[data-branch]").each(function (ignore, element) {
            let node = $(element);

            if (node.parent().hasClass("menu-open")) {
                menus.push(node.data("branch"));
            }
        });

        localStorage.EXPANDED_MENUS = JSON.stringify(menus);
    };

    let serialize = function (expression) {
        let data = {};
        let files = [];
        let form = $(expression);

        form.find("input,select,textarea").each(function (ignore, element) {
            let input;

            if (element.name) {
                switch (element.type) {
                case "checkbox":
                    if (!element.checked) {
                        combine(data, element.name, null);
                        return;
                    }
                    break;

                case "hidden":
                    if ($(element).is("[data-object-url]")) {
                        files.push(resources[element.value]);
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
            let list = {};

            $.each(Object.keys(data), function (ignore, name) {
                let tokens = name.split("@");

                if (tokens.length === 2) {
                    let id = tokens[1];

                    if (!list[id]) {
                        list[id] = {id};
                    }

                    list[id][tokens[0]] = data[name];

                    delete data[name];
                }
            });

            data.list = list;
        }

        return {data, files};
    };

    let settings = $.extend({
        latitude: 24.1736774,
        longitude: 120.6686102,
        map_zoom: 16,
        overview: "overview"
    }, $("script:last").data());

    let sortableAttachment = function (ignore, element) {
        Sortable.create(element, {
            animation: 200,
            filter: "button",
            onMove(event) {
                return event.related.classList.contains("attachment-wrapper");
            }
        });
    };

    let sortableOptions = function (ignore, element) {
        let unchecked = $(element);
        let checked = unchecked.prev("div.options-checked");

        unchecked.delegate("div", "click", function (event) {
            let option = $(event.currentTarget);

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

    let success = function (data, parameters) {
        if ($.isPlainObject(data)) {
            processJson(data, parameters);
        } else {
            $("response", data).each(processXml);
        }
    };

    let toggleControls = function (checked) {
        let list = [];

        checked.each(function (ignore, input) {
            list.push($(input).data("id"));
        });

        $("button[data-least]").data("args", list).each(function (ignore, element) {
            let button = $(element);

            button.prop("disabled", list.length < button.data("least"));
        });
    };

    let xhr = function () {
        let request = new XMLHttpRequest();

        request.upload.addEventListener("progress", function (event) {
            if (event.lengthComputable) {
                overlay.progress(Math.round(event.loaded * 100 / event.total));
            }
        }, false);

        return request;
    };

    _.templateSettings = {
        interpolate: /\{\{(.+?)\}\}/g
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

        form.find("div.google-map").each(initMap);

        form.find("div.options-unchecked").each(sortableOptions);

        form.find("div[data-format=color]").each(function (ignore, element) {
            let target = $(element);
            let input = target.find("input");
            let output = target.find(".input-group-text");

            target.colorpicker().on("colorpickerChange", function (event) {
                let color = "";

                if (event.color) {
                    color = event.color.toString();
                }

                output.css("background-color", color);
            });

            output.css("background-color", input.val());
        });

        form.find("div[data-format=time]").each(function (ignore, element) {
            let target = $(element);

            target.datetimepicker({
                format: target.data("pattern")
            });
        });

        form.find("input[data-format=date],input[data-format=datetime]").each(function (ignore, element) {
            let input = $(element);

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
            if (element.scrollHeight) {
                element.style.height = `${element.scrollHeight + 10}px`;
            }
        });

        if ($.fn.select2) {
            form.find("select.select2bs4").each(function (ignore, element) {
                let options = {theme: "bootstrap4"};
                let select = $(element);

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
                let select = $(element);
                let target = $(`select[name="${select.data("cascade")}"]`);
                let options = target.find("[data-parent-id]");

                select.on("change", function () {
                    let value = target.val();
                    target.append(options.remove().filter(`[data-parent-id="${select.val()}"]`)).val(value).trigger("change");
                }).change();
            }).end().filter("[data-search]").on("change", function (event) {
                let select = $(event.currentTarget);
                let inputs = select.closest("[id]").find("[data-name]");

                inputs.filter(":visible").addClass("d-none");
                inputs.find("input").val("");
                inputs.find("select").val("").trigger("change");
                inputs.filter(`[data-name="${select.val()}"]`).removeClass("d-none");
            });
        }

        if ($.fn.summernote) {
            form.find("textarea[data-format=html]").each(function (ignore, element) {
                let editor = $(element);
                let config = {height: 300, placeholder: editor.data("placeholder")};

                if (editor.is("[data-disabled]")) {
                    config.toolbar = [];

                    editor.summernote(config).summernote("disable");
                } else {
                    config.callbacks = {
                        onImageUpload(files) {
                            let data = new FormData();

                            $.each(files, function (ignore, file) {
                                if (file.size > settings.maxFileSize) {
                                    toastr.error(render(i18n.fileSize, {max: settings.maxFileSize, name: file.name, size: file.size}));
                                    return;
                                }

                                data.append("images[]", file);
                            });

                            if (!data.has("images[]")) {
                                return;
                            }

                            perform("file/upload-images", {target: `#${form.attr("id")} textarea[name="${editor.attr("name")}"]`}, {form: data});
                        }
                    };

                    editor.summernote(config);
                }
            });
        }

        if (window.CKEDITOR) {
            form.find("textarea[data-format=html]").each(function (ignore, element) {
                let editor = $(element);

                editor.ckeditor({
                    allowedContent: true,
                    baseHref: document.baseURI.match(/^(.*\/)(\w+\/)$/)[1],
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
        $(".modal").modal("hide");

        perform(event.state.path, {});
    };

    window.perform = perform;

    window.toggleMenu = function (name) {
        name = name || $(".breadcrumb-item[data-menu]").first().data("menu");

        let menu = $(`a[data-leaf][href="${name}"]`).blur();

        $("a.active[data-leaf]").removeClass("active");

        menu.addClass("active").parents(".has-treeview").addClass("menu-open").children("ul").css("display", "block");

        saveMenu();

        $("body.sidebar-open").toggleClass("sidebar-collapse sidebar-open");
    };

    $("button[data-language]").click(function (event) {
        location.href = $(event.currentTarget).data("path") + location.href.substring(document.baseURI.length);
    });

    $(document).delegate("a[data-ajax]", "click", function (event) {
        let anchor = $(event.currentTarget);
        let modal = anchor.closest(".modal");
        let path = anchor.attr("href");

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
    }).delegate("a[data-path][data-toggle=tab]", "shown.bs.tab", function (event) {
        if (event.relatedTarget) {
            $($(event.relatedTarget).attr("href")).empty();
        }

        perform($(event.target).data("path"), {});
    }).delegate("a[data-picker]", "click", function (event) {
        let button = $(event.currentTarget);

        $(`input[data-node="${button.data("node")}"]`).val(button.data("title")).siblings("input").val(button.data("picker"));

        $(".modal").modal("hide");
    }).delegate("a[data-toggle=lightbox]", "click", function (event) {
        $(event.currentTarget).ekkoLightbox();

        return false;
    }).delegate("button.attachment-picker", "click", function (event) {
        $(event.currentTarget).siblings("input[type=file]").click();
    }).delegate("button.attachment-picker", "dragenter dragover", function (event) {
        $(event.currentTarget).addClass("highlight");

        return false;
    }).delegate("button.attachment-picker", "dragleave", function (event) {
        $(event.currentTarget).removeClass("highlight");

        return false;
    }).delegate("button.attachment-picker", "drop", function (event) {
        let files;
        let picker = $(event.currentTarget).removeClass("highlight");

        if (picker.hasClass("picture-picker")) {
            files = [];

            $.each(event.originalEvent.dataTransfer.files, function (ignore, file) {
                if (file.type.startsWith("image/")) {
                    files.push(file);
                }
            });
        } else {
            files = event.originalEvent.dataTransfer.files;
        }

        if (files.length) {
            appendAttachment(picker, files);
        }

        return false;
    }).delegate("button[data-ajax]", "click", function (event) {
        let button = $(event.currentTarget);
        let form = button.data("form");
        let options;

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
        let file = $(event.currentTarget).closest(".attachment-wrapper");
        let picker = file.siblings(".attachment-picker").removeClass("d-none");

        file.find("input[data-object-url]").each(function (ignore, element) {
            URL.revokeObjectURL(element.value);

            delete resources[element.value];
        });

        file.remove();

        if (!picker.siblings(".attachment-wrapper").length) {
            let name = picker.data("name");
            let suffix = picker.data("suffix");

            picker.after(`<input name="${name}${suffix}" type="hidden"><input name="${name}#filename${suffix}" type="hidden">`);
        }
    }).delegate("form[data-search]", "submit", function (event) {
        let form = `#${$(event.target).attr("id")}`;
        let data = serialize(form).data;
        let path = history.state.path;
        let search = {};

        $.each(Object.keys(data), function (ignore, name) {
            let value = data[name];

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

        return false;
    }).delegate("button[data-upload]", "click", function (event) {
        let input = $(event.currentTarget).siblings("input");

        if (!input.data("binding")) {
            input.on("change", function () {
                let file = input[0].files && input[0].files[0];

                if (file) {
                    if (file.size > settings.maxFileSize) {
                        toastr.error(render(i18n.fileSize, {max: settings.maxFileSize, name: file.name, size: file.size}));
                        return;
                    }

                    let form = new FormData();

                    form.append("file", file);

                    perform(input.data("ajax"), {}, {form});

                    input.val("");
                }
            });

            input.data("binding", true);
        }

        input.click();
    }).delegate("input[data-all][type=checkbox]", "change", function (event) {
        let checkbox = $(event.currentTarget);
        let list = $(`input[data-group="${checkbox.data("group")}"][data-id][type=checkbox]`);

        list.prop("checked", checkbox.prop("checked"));

        toggleControls(list.filter(":checked"));
    }).delegate("input[data-id][type=checkbox]", "change", function (event) {
        let group = $(event.currentTarget).data("group");
        let list = $(`input[data-group="${group}"][data-id][type=checkbox]`);
        let checked = list.filter(":checked");

        $(`input[data-all][data-group="${group}"][type=checkbox]`).prop("checked", list.length === checked.length);

        toggleControls(checked);
    }).delegate("input[data-switch][type=checkbox]", "change", function (event) {
        let checkbox = $(event.currentTarget).prop("disabled", true);
        let value = checkbox.prop("checked");

        perform(`set-${checkbox.data("switch")}`, {id: checkbox.attr("id"), value}, {overlay: false}).fail(function () {
            checkbox.prop("checked", !value);
        }).always(function () {
            checkbox.prop("disabled", false);
        });
    }).delegate("select[data-reaction]", "change", function (event) {
        let parameters = {};
        let select = $(event.currentTarget);

        parameters[select.attr("name")] = select.val();

        perform(select.data("reaction"), parameters);
    }).delegate("select[name=p]", "change", function (event) {
        redirect({path: build(history.state.path, {p: $(event.currentTarget).val()})});
    }).delegate("span.search-place", "click", function (event) {
        let input = $(event.currentTarget).parent().siblings("input");
        let position;
        let query = input.val().trim();

        if (query) {
            let container = input.parent().siblings("div.google-map");

            if (container.data("map")) {
                let matches = query.match(/^(-?\d+\.\d+),(-?\d+\.\d+)$/);

                if (matches) {
                    position = new google.maps.LatLng(matches[1], matches[2]);

                    container.data("map").setCenter(position);
                    container.data("marker").setPosition(position);
                } else {
                    container.data("service").findPlaceFromQuery({fields: ["geometry"], query}, function (results, status) {
                        if (status === google.maps.places.PlacesServiceStatus.OK && results.length) {
                            position = results[0].geometry.location;

                            container.data("map").setCenter(position);
                            container.data("marker").setPosition(position);
                        }
                    });
                }
            }
        }
    }).ready(function () {
        $("ul[data-widget=treeview]").on("collapsed.lte.treeview expanded.lte.treeview", saveMenu);

        if (localStorage.EXPANDED_MENUS) {
            $.each(JSON.parse(localStorage.EXPANDED_MENUS), function (ignore, menu) {
                $(`a[data-branch="${menu}"]`).parent().addClass("menu-open").children("ul").css("display", "block");
            });
        }

        if (window.CKEDITOR) {
            window.CKEDITOR.dtd.$removeEmpty.i = 0;
        }

        if (history.state) {
            perform(history.state.path, {});
        } else {
            redirect({path: settings.path + location.search}, true);
        }
    });

}());
