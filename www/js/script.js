// Define global variables
var host = document.location.hostname === "localhost" ? "http://localhost:8087/" : "http://api.collectquotesave.com/";
var db;
var tag_picture_element = null;
var harcodedMaterials = false;
var harcodedFinishings = false;
var showSubmit = false;

var materials_table = "materials";

var current_tag_count = 0;
var selected_material_id = null;
var active_materials = [];
var active_finishings = [];

// DB tables structures 
var settings_table = "settings";
var settings_table_columns = "id integer primary key, name text, value text, reference_id integer";
var settings_table_values = {
    // "persistent": [sales_person_name, sales_person_email],
    "persistent": [1, 2],
    // "transient": [distributor, distributor_contact, distributor_email, end_user, end_user_contact, end_user_email]
    "transient": [3, 4, 5, 6, 7, 8]
};
var tags_finishings_table = "tags_finishings";
var tags_finishings_table_columns = "tag_id integer, finishing_id integer";
var tags_table = "tags";
var tags_table_columns = "id integer primary key, name text, material_id integer, size_height integer, size_width integer, size_unit text, quantity text, annual_usage text, photo_front text, photo_back text, notes text, finishing_range_start integer, finishing_range_end integer";
var ws_tag_materials_table = "tag_materials";
var ws_tag_materials_table_columns = "id integer primary key, name text";
var ws_tag_finishings_table = "tag_finishings";
var ws_tag_finishings_table_columns = "id integer primary key, name text, is_range integer";

document.addEventListener("offline", goOffline, false);
document.addEventListener("online", goOnline, false);

// Online mode is selected by default
var onlineFlag = true;
function goOnline(){
    if(onlineFlag !== true){
        onlineFlag = true;
        // The app swtiched from online mode to offline mode
        switchMode("online");
    }
    
    onlineFlag = true;
    
    console.log("Accuform Tag is online");
}

function goOffline(){
    if(onlineFlag !== false){
        // The app was opened in offline mode or it swtiched from online mode to offline
        onlineFlag = false;
        switchMode("offline");
    }
    onlineFlag = false;
    
    console.log("Accuform Tag is offline");
}

function switchMode(mode){
    if(mode === "offline"){
        $(".online-header").each(function() {
            $(this).removeClass("online-header").addClass("offline-header");
        });
        $(".onlineH1").each(function() {
            $(this).hide();
        });
        $(".offlineH1").each(function() {
            $(this).show();
        });
        $("#history-button").hide();
        toggleSubmitButton(false);
        
        // If the current page is the history one, redirect to home
        if($.mobile.activePage.attr('id') === "history"){
            window.location.href = "#home";
        }
    }else if(mode === "online"){
        console.log("switch to online mode");
        $(".offline-header").each(function() {
            $(this).removeClass("offline-header").addClass("online-header");
        });
        $("#history-button").show();
        $(".onlineH1").each(function() {
            $(this).show();
        });
        $(".offlineH1").each(function() {
            $(this).hide();
        });
        if(showSubmit === true){
            toggleSubmitButton(true);
        }
        
        if(active_materials.length === 0 || harcodedMaterials === true){
            console.log("App is back online but it has no active_materials, fetch from WS.");
            wsGetTagMaterials();
        }else{
            console.log("App is back online, no need to fetch new materials, harcodedMaterials = "+harcodedMaterials);
            console.log("App is back online, no need to fetch new materials, active_materials length = "+active_materials.length);
        }
        
        if(active_finishings.length === 0 || harcodedFinishings === true){
            console.log("App is back online but it has no active_finishings, fetch from WS.");
            wsGetTagFinishings();
        }else{
            console.log("App is back online, no need to fetch new finishings, harcodedFinishings = "+harcodedFinishings);
            console.log("App is back online, no need to fetch new finishings, active_finishings length = "+active_finishings.length);
        }
        
    }
}

$(document).ready(function(){
    

//$("#home").on('click', 'a.select-distributor', function () {
//    // When a distributor is selected from the look-up list, fill input with value and clear suggestions list
//    var id = $(this).attr("data-id");
//    var name = $(this).text();
//
//    $("#autocomplete-distributor").addClass("selected");
//    $("#distributor").attr("data-db-reference", id).val(name).trigger("change");
//});

//$("#home").on("change", "input#distributor", function () {
//    // When the distributor input changes, check if this is actually a new value or one from the list of predefined options
//    var value = $(this).val();
//    if(value !== "" && typeof($(this).attr("data-db-reference")) !== "undefined" && $(this).attr("data-db-reference") !=="" && $(this).hasClass("prefilled") === false){
//        $(this).addClass("prefilled");
//    }else if($(this).hasClass("prefilled") === true || value === ""){
//        $(this).removeClass("prefilled").removeAttr("data-db-reference");
//    }
//});

$("#home").on("change", "input.db-prefill", function () {
    // When an input changes, store value to local database
    console.log("#home change input.db-prefill saveSettingData");
    var reference = typeof($(this).attr("data-db-reference")) === "undefined" ? null : $(this).attr("data-db-reference");
    saveSettingData($(this).attr("data-db-table"), $(this).attr("data-db-id"), $(this).attr("id"), $(this).val(), reference);
});

$("#home").on('click', '#clear-main-screen', function () {
    // Clear main screen content
    navigator.notification.confirm(
            'Clear all content?', // message
            clearMainScreen, // callback to invoke with index of button pressed
            'Clear main screen', // title
            ['Clear All', 'Cancel']         // buttonLabels
            );
});

$("#home").on('click', '.edit-tag', function () {
    selected_material_id = null;
    var tag_id = $(this).parent().attr("data-tag-id");
    var edit_tag = tag_id !== "undefined" && tag_id !== null && tag_id !== "";

    if(edit_tag === true){
        // Edit selected tag, load all tag data
        displayTagById(tag_id);
    }

    $("#tag #add-tag-header").toggle(!edit_tag);
    $("#tag #edit-tag-header").toggle(edit_tag);
});

$("#home").on('click', '.delete-tag', function () {
    var tag_name = $(this).siblings("label.tag-name").html();
    var tag_id = $(this).parent().attr("data-tag-id");
    $("#delete-tag-popup .ui-title span#delete-tag-name").html(tag_name);
    $("#delete-tag-popup .ui-content .confirm-tag-delete").attr("data-delete-tag-id", tag_id);
});

$("#home").on('click', '.confirm-tag-delete', function () {
    var tag_id = $(this).attr("data-delete-tag-id");
    if(typeof(tag_id) !== "undefined"){
        // Edit selected tag, load all tag data
        deleteTagById(tag_id); 
    }
});

$("#home").on('click', '.add-tag', function () {
    // Get current tag count
    getTagCount();

    // When adding a new tag, clear all previos tag data
    clearTagData();
});

$("#home").on('click', '#submit-quote', function () {
    var valid = dataIsValid("#home");

    if(valid === false){
        // If the inputs failed the validity check, do not proceed
        return;
    }

    $.mobile.loading( 'show');

    sendAllData();
});

//$("#home #autocomplete-distributor").on("filterablebeforefilter", function (e, data) {
//    var ul = $(this);
//    var input = $(data.input);
//    var value = input.val();
//    var html = "";
//    $(this).html("");
//        if (value && value.length > 2 && $(this).hasClass("selected") === false && onlineFlag === true) {
//            ul.html("<li><div class='ui-loader'><span class='ui-icon ui-icon-loading'></span></div></li>");
//            ul.listview("refresh");
//            $.ajax({
//                    url: host + "api/web/tags/v1/distributors/search?name=" + input.val(),
//                    dataType: "json",
//                    crossDomain: true,
//            })
//            .then(function (response) {
//                    $.each(response, function (i, val) {
//                            html += "<li><a href='#' class='ui-icon-star select-distributor' data-id='" + val.id + "'>" + val.account_number + " " + val.name + "</a></li>";
//                    });
//                    ul.html(html);
//                    ul.listview("refresh");
//                    ul.trigger("updatelayout");
//            });
//        }else if($(this).hasClass("selected") === true){
//        $(this).removeClass("selected");
//    }
//});

$("#home").on("pagebeforeshow", function () {
    selected_material_id = null;
    fetchData();
});

// Before displaying each page, hide error validation style
$("div[data-role=page]").on("pagebeforeshow", function () {
    removeErrorStyle("#"+$(this).attr("id"));
});

// Remove invalid style when the fields are focused into
$("div[data-role=page]").on("focus", ".ui-field-contain.required-error input", function () {
    $(this).parents(".ui-field-contain.required-error").first().removeClass("required-error");
});

$("#tag").on("pageinit", function (event, ui) {
    console.log("#tag pageinit");
    $('#tag select#tag-material').val("").selectmenu('refresh', true);
    $('#tag select#tag-finishing').val("").selectmenu('refresh', true);

    
    if(active_materials.length > 0){        
        console.log("#tag pagecreate active_materials are: "+JSON.stringify(active_materials));
        
        for (i = 0; i < active_materials.length; i++) {
            var material = active_materials[i];
            var optionValue = material.id;
            var optionText = material.name;
            $('#tag-material').append('<option value="' + optionValue + '">' + optionText + '</option>');
        }

        if(selected_material_id !== null){
            $('#tag select#tag-material option[value="' + selected_material_id + '"]').attr("selected", "selected");
        }else{
            $('#tag select#tag-material option[value=""]').attr("selected", "selected");
        }

        $('#tag-material').selectmenu('refresh', true);
    }else{
        console.log("#tag pagecreate there are NO active_materials");
    }

    if(active_finishings.length > 0){
        for (i = 0; i < active_finishings.length; i++) {
            var finishing = active_finishings[i];
            var optionValue = finishing.id;
            var optionText = finishing.name;
            var isRange = finishing.is_range;
            $('#tag-finishing').append('<option value="' + optionValue + '" data-is-range="'+isRange+'" >' + optionText + '</option>');
        }
        $('#tag-finishing').selectmenu('refresh', true);
    }

    $("#tag").on("click", ".take-picture", function () {
        // When the user to chooses to add a picture to a tag, mark if it's for the front or the back
        tag_picture_element = $("img", this).attr("id");
    });

    $("#tag").on("click", ".choose-picture", function () {
        // Allow the user to choose an existing picture or for them to take a new one
        var sourceType = $(this).attr("id") === "choose-picture-existent" ? Camera.PictureSourceType.PHOTOLIBRARY : Camera.PictureSourceType.CAMERA;
        navigator.camera.getPicture(getPictureSuccess, getPictureFail, {
            quality: 5,
            destinationType: Camera.DestinationType.FILE_URI,
            sourceType: sourceType
        });
    });

    $("#tag").on("click", "#save-tag", function () {
        var valid = dataIsValid("#tag");

        if(valid === false){
            // If the inputs failed the validity check, do not proceed
            return;
        }

        // When the user saves a tag, add/update in the local db record
        var annual_usage = $("#tag #annual-usage").val();
        var finishing_range_end = $("#tag #tag-finishing-range").css("display") === "block" ? $("#tag #tag-finishing-range #tag-finishing-range-end").val() : null;
        var finishing_range_start = $("#tag #tag-finishing-range").css("display") === "block" ? $("#tag #tag-finishing-range #tag-finishing-range-start").val() : null;
        var finishings = $("#tag #tag-finishing").val().filter(function(v){return v!==''});
        var material_id = $("#tag #tag-material").val();
        var notes = $("#tag #tag-notes").val();
        var photo_back = $("#tag input#tag_photo_back").val();
        var photo_front = $("#tag input#tag_photo_front").val();
        var quantity = $("#tag #quantity").val();
        var size_height = $("#tag #size-height").val();
        var size_unit = $("#tag input[name=tag-size-unit]:checked").attr("data-value");
        var size_width = $("#tag #size-width").val();
        var tag_id = $("#tag #current_tag_id").val() !== "" ? parseInt($("#tag #current_tag_id").val()) : "";
        var tag_name = $("#tag #tag-name").val() !== "" ? $("#tag #tag-name").val() : "Tag";

        // This exact order of indexes must be kept
        var tag_data = [
            tag_id === "" ? null : tag_id,
            escapeHtml(tag_name),
            material_id !== null && material_id !== "" ? material_id : null,
            size_height !== null && size_height !== "" ? size_height : null,
            size_width !== null && size_width !== "" ? size_width : null,
            size_unit !== null && size_unit !== "" ? size_unit : null,
            quantity !== null && quantity !== "" ? escapeHtml(quantity) : null,
            annual_usage !== null && annual_usage !== "" ? escapeHtml(annual_usage) : null,
            photo_front !== null && photo_front !== "" ? photo_front : null,
            photo_back !== null && photo_back !== "" ? photo_back : null,
            notes !== null && notes !== "" ? escapeHtml(notes) : null,
            typeof(finishings) === "object" && finishings.length > 0 && finishing_range_start !== null && finishing_range_start !== "" ? finishing_range_start : null,
            typeof(finishings) === "object" && finishings.length > 0 && finishing_range_end !== null && finishing_range_end !== "" ? finishing_range_end : null,

        ];

        saveTag(tag_data, finishings);
    });

    $("#tag").on("change", "#tag-finishing", function () {
        // If the current user selected a value that requires the range slider, clear the slider previous selection and diplay it
        var show_range = $("#tag select#tag-finishing option:selected[data-is-range='1']").length > 0 ? true : false;

        if(show_range === true && $("#tag #tag-finishing-range").css("display") !== "block"){
            // If the range selector needs to be shown, clear all previous selection 
            var min = $("#tag #tag-finishing-range #tag-finishing-range-start").attr("min");
            var max = $("#tag #tag-finishing-range #tag-finishing-range-end").attr("max");
            $("#tag #tag-finishing-range #tag-finishing-range-start").val(min);
            $("#tag #tag-finishing-range #tag-finishing-range-end").val(max);
            $("#tag #tag-finishing-range").rangeslider("refresh").toggle(show_range);
        }else if(show_range === false && $("#tag #tag-finishing-range").css("display") === "block"){
            $("#tag #tag-finishing-range").toggle(show_range);
        }
    });
});

document.addEventListener("deviceready", function () {
    //wsWakeUp();
    console.log("deviceready triggered");
    
    if(navigator.connection.type == Connection.NONE){
        goOffline();
    }
    
    fetchData();
}, true);

$("#history").on("pagebeforecreate", function () {
    $("#history").on("pagebeforeshow", function () {
        // Clear all the previously shown quotes
        $("#quotes-list").html("");
        current_history_page = 0;
        getHistory();
    });

    $("#history").on("click", "#load-quotes", function () {
        getHistory();
    });

    $("#history").on("click", "#quotes-list li", function () {
        console.log("#history click #quotes-list li");
        deleteAllTags();

        // Save quote data into local database
        $("span.quote", this).each(function(){
            var value = $(this).text();
            var input_element = $("input#"+$(this).attr("data-id"));
            var reference = typeof($(this).attr("data-db-reference")) === "undefined" || $(this).attr("data-db-reference") === "" ? null : $(this).attr("data-db-reference");
            saveSettingData($(input_element).attr("data-db-table"), $(input_element).attr("data-db-id"), $(input_element).attr("id"), value, reference);
        });

        // Save tags data into local database
        $("p.tag", this).each(function(){
            var tag_id = "";
            var tag_name = $('span[data-id="tag-name"]', this).text();
            var material_id = $('span[data-id="tag-material"]', this).text();
            var size_height = $('span[data-id="size-height"]', this).text();
            var size_width = $('span[data-id="size-width"]', this).text();
            var size_unit = $('span[data-id="tag-size-unit"]', this).text();
            var quantity = $('span[data-id="quantity"]', this).text();
            var annual_usage = $('span[data-id="annual_usage"]', this).text();
            var photo_front = "";
            var photo_back = "";
            var notes = "";
            var finishings = $(this).attr("data-finishings-ids");
            var finishing_range_start =  $('span[data-id="tag-finishing-range-start"]', this).text();
            var finishing_range_end = $('span[data-id="tag-finishing-range-end"]', this).text();

            var tag_data = [
                tag_id === "" ? null : tag_id,
                escapeHtml(tag_name),
                material_id !== null && material_id !== "" ? material_id : null,
                size_height !== null && size_height !== "" ? size_height : null,
                size_width !== null && size_width !== "" ? size_width : null,
                size_unit !== null && size_unit !== "" ? size_unit : null,
                quantity !== null && quantity !== "" ? escapeHtml(quantity) : null,
                annual_usage !== null && annual_usage !== "" ? escapeHtml(annual_usage) : null,
                photo_front !== null && photo_front !== "" ? photo_front : null,
                photo_back !== null && photo_back !== "" ? photo_back : null,
                notes !== null && notes !== "" ? escapeHtml(notes) : null,
                typeof(finishings) === "object" && finishings.length > 0 && finishing_range_start !== null && finishing_range_start !== "" ? parseInt(finishing_range_start) : null,
                typeof(finishings) === "object" && finishings.length > 0 && finishing_range_end !== null && finishing_range_end !== "" ? parseInt(finishing_range_end) : null,
            ];

            saveTag(tag_data, (finishings !== "" ? finishings.split(",") : []));
        });

        window.location.href = "#home";
    });
});
});

function getHistory(){
    if(current_history_page === null || current_history_fetch === true){
        // Skip fetching the history records if there is no need for it
        return;
    }
    
    // Get the sales person email address and their history records
    var db = sqlitePlugin.openDatabase({name: "accuform.tags", location: 1, androidLockWorkaround: 1});//window.sqlitePlugin.openDatabase({name: "accuform.tags", location: 1, androidLockWorkaround: 1});
    var sql = "SELECT value FROM " + settings_table + " WHERE id=2;";
    db.transaction(function (tx) {
        tx.executeSql(sql, [], function (tx, res) {
            if (res.rows.length > 0 && res.rows.item(0).value !== null && res.rows.item(0).value !== "") {
                wsGetHistory(res.rows.item(0).value);
            }
        });
    });
}

function escapeHtml(string) {
    var entityMap = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': '&quot;',
        "'": '&#39;',
        "/": '&#x2F;'
    };
    return String(string).replace(/[&<>"'\/]/g, function (s) {
        return entityMap[s];
    });
}


var current_history_page = null;
var current_history_fetch = false;
function wsGetHistory(sales_person_email){
    if(current_history_page === null || current_history_fetch === true || onlineFlag === false){
        // Skip fetching the history records if there is no need for it
        return;
    }
    
    current_history_fetch = true;
    if(current_history_page !== 0){
        $.mobile.loading('show');
    }else{
        // This is the first time the list is loading
        $("#quotes-list").html("");
    }
    
    var url = host + "api/web/tags/v1/quotes/history?per-page=5&";
    url += "sales_person_email="+sales_person_email;
    url += "&page="+current_history_page;
    
    console.log("wsGetHistory from url "+url);
    $.ajax({
        type: "GET",
        url: url,
        dataType: "json",
        crossDomain: true
    })
    .done(function(quotes, textStatus, request) {
        if(quotes.length > 0){
            for (i = 0; i < quotes.length; i++) {
                var quote = quotes[i];
        
                // Extract and display tag information
                var tags_string = '';
                if(quote.tags.length > 0){
                    for (j = 0; j < quote.tags.length; j++) {
                        var tag = quote.tags[j];
                        
                        var tag_finishings = "";
                        if(tag.tagFinishings !== null && tag.tagFinishings.length > 0){
                            tag_finishings = tag.tagFinishings.map(function(elem){
                                return elem.id;
                            }).join(",");
                        }
                        
                        var tagString = '<p class="tag" style="padding-right: 10px;" data-finishings-ids="'+tag_finishings+'">'+
                                '<strong><span data-id="quantity">'+tag.quantity+'</span>x Tag:</strong> '+
                                '<span data-id="annual_usage">'+tag.annual_usage+'</span>'+', '+
                                '<span data-id="tag-name">'+tag.name+'</span>'+', '+
                                '<span data-id="tag-material" style="display: none">'+ (tag.material.id)+'</span>'+
                                '<span data-id="tag-finishing-range-end" style="display: none">'+tag.finishing_range_end+'</span>'+
                                '<span data-id="tag-finishing-range-start" style="display: none">'+tag.finishing_range_start+'</span>'+
                                tag.material.name+', '+
                                '<span data-id="size-height">'+tag.size_height+'</span>'+' X '+
                                '<span data-id="size-width">'+tag.size_width+'</span>'+' '+
                                '<span data-id="tag-size-unit">'+tag.size_unit+'</span>'+ '</p>';
                        tags_string += tagString;
                    }
                }

                var quoteHtml = '<li data-id="'+quote.id+'">'+
                    '<a href="#">'+
                    '<h2>Quote</h2>'+
                    '<p><strong>Distributor:</strong> <span class="quote" data-id="distributor" data-db-reference="'+(quote.distributor ? quote.distributor.id : '')+'">'+ (quote.distributor_name !== null ? quote.distributor_name : quote.distributor.name) +'</span></p>'+
                    '<p><strong>Distributor Contact:</strong> <span class="quote" data-id="distributor_contact">'+quote.distributor_contact+'</span></p>'+
                    '<p><strong>Distributor Email:</strong> <span class="quote" data-id="distributor_email">'+quote.distributor_email+'</span></p>'+
                    '<p><strong>End-User:</strong> <span class="quote" data-id="end_user">'+quote.end_user+'</span></p>'+
                    '<p><strong>End-User Contact:</strong> <span class="quote" data-id="end_user_contact">'+quote.end_user_contact+'</span></p>'+
                    '<p><strong>End-User Email:</strong> <span class="quote" data-id="end_user_email">'+quote.end_user_email+'</span></p>'+
                    '<p class="ui-li-aside">'+quote.created_on+'</p>'+
                    tags_string+
                    '</a></li>';
                $("#quotes-list").append(quoteHtml);
            }
            $("#quotes-list").listview('refresh');
        }

        var total_pages = request.getResponseHeader('X-Pagination-Page-Count');
        var current_page = request.getResponseHeader('X-Pagination-Current-Page');

        if(current_page === total_pages){
            current_history_page = null;
        }else{
            current_history_page++;
        }            
    })
    .fail(function( jqXHR, textStatus ) {
        console.log("wsGetHistory Request failed: " + textStatus );
    })
    .always(function() {
        current_history_fetch = false;
        $.mobile.loading("hide");

        // If this is the first set of batches, add the scroll handlers and add new batches if needed
        if(current_history_page !== null){
            $("#history #load-quotes").show();
        }else{
            $("#history #load-quotes").hide();
        }
    });
}

function copyPhoto(fileEntry) {
    window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, function(fileSys) { 
        fileSys.root.getDirectory("photos", {create: true, exclusive: false}, function(dir) {                 
                var fileName = "ACC_";
                
                var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
                for( var i=0; i < 5; i++ )
                    fileName += possible.charAt(Math.floor(Math.random() * possible.length));
                
                var extension = fileEntry.name.substr(fileEntry.name.lastIndexOf("."));
                fileName += extension;
                
                fileEntry.copyTo(dir, fileName, onCopySuccess, fail); 
            }, fail); 
    }, fail); 
};

function onCopySuccess(entry) {
    console.log(entry.fullPath);
    var imageURI = entry.nativeURL;
    var image = document.getElementById(tag_picture_element);
    image.src = imageURI;
    
    var inputSelector = tag_picture_element === "choose-picture-front" ? $("#tag input#tag_photo_front") : $("#tag input#tag_photo_back");
    inputSelector.val(imageURI);
          
    tag_picture_element = null;
    $("#choose-picture").popup("close");
}

function fail(error) {
    console.log(error.code);
    tag_picture_element = null;
    $("#choose-picture").popup("close");
}

function getPictureSuccess(imageURI) {
    window.resolveLocalFileSystemURL(imageURI, copyPhoto, fail);
}

function getPictureFail(message) {
    tag_picture_element = null;
    $("#choose-picture .error-message").text(message).show();
    $("#choose-picture").popup("close");
}

function saveSettingData(table, id, name, value, reference_id) {
    var db = sqlitePlugin.openDatabase({name: "accuform.tags", location: 1, androidLockWorkaround: 1});//window.sqlitePlugin.openDatabase({name: "accuform.tags", location: 1, androidLockWorkaround: 1});
    var sql = "INSERT OR REPLACE INTO "+table+" (id, name, value, reference_id) VALUES ("+id+", '"+name+"', '"+value+"', "+reference_id+")";
    console.log("sql: "+sql);

    db.transaction(function (tx) {
        tx.executeSql(sql, [], function (tx, res) {
            console.log("sql was executed. result: "+JSON.stringify(res));
        });
    });
}

function displayTags(){
    if(typeof(window.sqlitePlugin) === "undefined"){
        return;
    }
    
    console.log("displayTags called");
    
    var db = sqlitePlugin.openDatabase({name: "accuform.tags", location: 1, androidLockWorkaround: 1});//window.sqlitePlugin.openDatabase({name: "accuform.tags", location: 1, androidLockWorkaround: 1});
    var sql = "SELECT * FROM "+tags_table+" ORDER BY id ASC;";
    console.log(sql);
    var tagContainer = $("#home #tags-container");
    db.transaction(function (tx) {
        tx.executeSql(sql, [], function (tx, res) {
            console.log("tags count" +res.rows.length);
            toggleButtons(res.rows.length);
            if(res.rows.length > 0){
                for (i = 0; i < res.rows.length; i++) {
                    var tag = res.rows.item(i);
                    
                    if($('#home #tags-container div.ui-field-contain[data-tag-id="'+tag.id+'"]').length > 0 && $('#home #tags-container div.ui-field-contain[data-tag-id="'+tag.id+'"] > label').html() !== tag.name){
                        $('#home #tags-container div.ui-field-contain[data-tag-id="'+tag.id+'"] > label').html(tag.name);
                    }else if($('#home #tags-container div.ui-field-contain[data-tag-id="'+tag.id+'"]').length === 0){
                        // Prepend new 
                        var tagHtml = '<div class="ui-field-contain" data-tag-id="'+tag.id+'">' +
                                '<label class="tag-name">'+tag.name+'</label>' +
                                '<a href="#tag" class="ui-btn ui-corner-all ui-icon-edit ui-btn-icon-right ui-btn-inline edit-tag">Edit</a>' +
                                '<a href="#delete-tag-popup" data-rel="popup" class="ui-btn ui-corner-all ui-icon-delete ui-btn-icon-right ui-btn-inline delete-tag">Delete</a>' +
                        '</div>';
                        tagContainer.append(tagHtml);
                    }
                    
                }
            }
        });
    });
}

function clearTagData(){    
    selected_material_id = null;
    $("#tag input, #tag textarea").each(function(){
        $(this).val("");
    });
    
    $("#tag #tag-finishing, #tag #tag-material").each(function () {
        if ($(this).data("mobile-selectmenu") === undefined) {
            $(this).selectmenu();
        }
        $(this).val("").selectmenu('refresh', true);
    });
    
    // Clear previous range selections and hide the range slider only if the slider is currently displayed
    if($("#tag #tag-finishing-range").css("display") === "block"){
        var min = $("#tag #tag-finishing-range #tag-finishing-range-start").attr("min");
        var max = $("#tag #tag-finishing-range #tag-finishing-range-end").attr("max");
        $("#tag #tag-finishing-range #tag-finishing-range-start").val(min);
        $("#tag #tag-finishing-range #tag-finishing-range-end").val(max);
        if ($("#tag #tag-finishing-range").data("mobile-rangeslider") === undefined) {
            $("#tag #tag-finishing-range").rangeslider();
        }
        $("#tag #tag-finishing-range").rangeslider("refresh").toggle(false);
    }
    
    var image = document.getElementById("choose-picture-back");
    image.src = "img/camera_back.png";
    var image = document.getElementById("choose-picture-front");
    image.src = "img/camera_front.png";
}

function displayTagById(tag_id){
    var db = sqlitePlugin.openDatabase({name: "accuform.tags", location: 1, androidLockWorkaround: 1});//window.sqlitePlugin.openDatabase({name: "accuform.tags", location: 1, androidLockWorkaround: 1});
    var sql = "SELECT * FROM "+tags_table+" WHERE id=" + tag_id + ";";
    db.transaction(function (tx) {
        tx.executeSql(sql, [], function (tx, res) {
            if(res.rows.length > 0){
                var tag = res.rows.item(0);
                
                // Finishing Range End 
                // Finishing Range Start 
                if(tag.finishing_range_start !== null && tag.finishing_range_end !== null){
                    $("#tag #tag-finishing-range #tag-finishing-range-start").val(tag.finishing_range_start);
                    $("#tag #tag-finishing-range #tag-finishing-range-end").val(tag.finishing_range_end);
                    if ($("#tag #tag-finishing-range").data("mobile-rangeslider") === undefined) {
                        $("#tag #tag-finishing-range").rangeslider();
                    }
                    $("#tag #tag-finishing-range").rangeslider("refresh").toggle(true);
                }else if($("#tag #tag-finishing-range").css("display") === "block"){
                    var min = $("#tag #tag-finishing-range #tag-finishing-range-start").attr("min");
                    var max = $("#tag #tag-finishing-range #tag-finishing-range-end").attr("max");
                    $("#tag #tag-finishing-range #tag-finishing-range-start").val(min);
                    $("#tag #tag-finishing-range #tag-finishing-range-end").val(max);
                    if ($("#tag #tag-finishing-range").data("mobile-rangeslider") === undefined) {
                        $("#tag #tag-finishing-range").rangeslider();
                    }
                    $("#tag #tag-finishing-range").rangeslider("refresh").toggle(false);
                }

                // Material - Check if the materials were already added to the list
                if( $('#tag select#tag-material option').length > 1){
                    $('#tag select#tag-material').val(tag.material_id);
                    $('#tag select#tag-material').selectmenu('refresh', true);
                }else{
                    selected_material_id = tag.material_id;
                }
                
                // Notes
                var current_value = $('<textarea />').html(tag.notes).text();
                $("#tag #tag-notes").val(current_value);
                
                // Photo Back
                $("#tag input#tag_photo_back").val(tag.photo_back);
                var image = document.getElementById("choose-picture-back");
                image.src = tag.photo_back !== null && tag.photo_back !== "" ? tag.photo_back : "img/camera_back.png";
                 
                // Photo Front
                $("#tag input#tag_photo_front").val(tag.photo_front);
                var image = document.getElementById("choose-picture-front");
                image.src = tag.photo_front !== null && tag.photo_front !== "" ? tag.photo_front : "img/camera_back.png";
                
                // Quantity
                $("#tag #quantity").val(tag.quantity);
                
                // Annual Usage
                $("#tag #annual-usage").val(tag.annual_usage);
                
                // Size Height
                $("#tag #size-height").val(tag.size_height);
                
                // Size Width
                $("#tag #size-width").val(tag.size_width);
                
                // Size unit
                if($("#tag input[name=tag-size-unit]#tag-size-unit-"+tag.size_unit).lenght > 0){
                    $("#tag input[name=tag-size-unit]" ).prop( "checked", false);
                    $("#tag input[name=tag-size-unit]#tag-size-unit-"+tag.size_unit).prop("checked", true);
                    $("#tag input[name=tag-size-unit]" ).checkboxradio( "refresh" );
                }
                
                // Tag Id
                $("#tag #current_tag_id").val(tag.id);
                
                // Tag Name
                var current_value = $('<textarea />').html(tag.name).text();
                $("#tag #tag-name").val(current_value);
            }
        });
    });
    displayFinishingsByTagId(tag_id);
}

function deleteTagById(tagId){
    var db = sqlitePlugin.openDatabase({name: "accuform.tags", location: 1, androidLockWorkaround: 1});//window.sqlitePlugin.openDatabase({name: "accuform.tags", location: 1, androidLockWorkaround: 1});
    
    var delete_tag_finishings_sql_sql = "DELETE FROM "+tags_finishings_table+" WHERE tag_id=" + tagId + ";";
    var delete_tag_sql = "DELETE FROM "+tags_table+" WHERE id=" + tagId + ";";
    db.transaction(function (tx) {
        tx.executeSql(delete_tag_finishings_sql_sql, [], function (tx, res) {});
        tx.executeSql(delete_tag_sql, [], function (tx, res) {});
    });
    if ($('#home #tags-container div.ui-field-contain[data-tag-id="'+tagId+'"]').length > 0){
        $('#home #tags-container div.ui-field-contain[data-tag-id="'+tagId+'"]').remove();
    }
}

function getTagCount(){
    var db = sqlitePlugin.openDatabase({name: "accuform.tags", location: 1, androidLockWorkaround: 1});//window.sqlitePlugin.openDatabase({name: "accuform.tags", location: 1, androidLockWorkaround: 1});
    var sql = "SELECT MAX(id) as lastInsertedId FROM "+tags_table+";";
    db.transaction(function (tx) {
        tx.executeSql(sql, [], function (tx, res) {
            current_tag_count = res.rows.item(0).lastInsertedId !== null ? parseInt(res.rows.item(0).lastInsertedId) : 0;
        });
    });
}

function saveTag(tag_data, finishings) {
    var db = sqlitePlugin.openDatabase({name: "accuform.tags", location: 1, androidLockWorkaround: 1});//window.sqlitePlugin.openDatabase({name: "accuform.tags", location: 1, androidLockWorkaround: 1});
    
    var tag_data_string = '';
    for (i = 0; i < tag_data.length; i++) {       
        tag_data_string += (tag_data[i] !== null ? '"'+ tag_data[i].toString() +'"' : "null") + (i < tag_data.length-1 ? ', ': '');
    }
    
    var save_tag_sql = "INSERT OR REPLACE INTO " + tags_table + " (id, name, material_id, size_height, size_width, size_unit, quantity, annual_usage, photo_front, photo_back, notes, finishing_range_start, finishing_range_end) VALUES (" + tag_data_string + ")";
    var delete_tag_finishings_sql = tag_data[0] !== "null" ? "DELETE FROM "+tags_finishings_table+" WHERE tag_id=" + tag_data[0] + ";" : "";

    console.log("save_tag_sql: "+save_tag_sql);
    try {
        db.transaction(function (tx) {
            if(delete_tag_finishings_sql !== ""){
                tx.executeSql(delete_tag_finishings_sql, [], function (tx, res) {});
            }

            try {
                tx.executeSql(save_tag_sql, [], function (tx, res) {
                    var tag_id = res.insertId;
                    var create_tag_finishings_sql = "";
                    if(typeof(finishings) === "object" && finishings.length > 0){
                        var finishings_values_array = [];
                        for (i = 0; i < finishings.length; i++) {
                            finishings_values_array.push("("+tag_id+", "+finishings[i]+")");
                        }
                        create_tag_finishings_sql = "INSERT INTO " + tags_finishings_table + " (tag_id, finishing_id) VALUES " + finishings_values_array.join(", ") + "";
                    }
                    
                    console.log("save_tag_sql insertId: " + res.insertId + " -- probably 1");
                    console.log("save_tag_sql rowsAffected: " + res.rowsAffected + " -- should be 1");
                    console.log("create_tag_finishings_sql: "+create_tag_finishings_sql);
                    
                    if (create_tag_finishings_sql !== "") {
                        tx.executeSql(create_tag_finishings_sql, [], function (tx, res) {});
                    }
                });
            } catch (error) {
                console.log("ERROR save_tag_sql: ".JSON.stringify(error));
            }
            
            window.location.href = "#home";
        });
    } catch (error) {
        console.log("ERROR saveTag: ".JSON.stringify(error));
    }
}

function fetchData() {
    var db = sqlitePlugin.openDatabase({name: "accuform.tags", location: 1, androidLockWorkaround: 1});//window.sqlitePlugin.openDatabase({name: "accuform.tags", location: 1, androidLockWorkaround: 1});
    console.log("fetchData has started");
    db.transaction(function (tx) {
        tx.executeSql("CREATE TABLE IF NOT EXISTS " + settings_table + " ("+settings_table_columns+")");
        tx.executeSql('CREATE TABLE IF NOT EXISTS materials (id integer primary key, name text, version_id integer)');
        tx.executeSql("CREATE TABLE IF NOT EXISTS " + tags_table + " ("+tags_table_columns+");");
        tx.executeSql("CREATE TABLE IF NOT EXISTS " + tags_finishings_table + " ("+tags_finishings_table_columns+");");
        tx.executeSql("CREATE TABLE IF NOT EXISTS " + ws_tag_materials_table + " ("+ws_tag_materials_table_columns+");");
        tx.executeSql("CREATE TABLE IF NOT EXISTS " + ws_tag_finishings_table + " ("+ws_tag_finishings_table_columns+");");

        $("#home input.db-prefill").each(function(){
            var table = $(this).attr("data-db-table");
            var id = $(this).attr("data-db-id");
            var element = $(this);

            var sql = "SELECT * FROM "+table+" WHERE id='"+id+"';";
            console.log("sql is : "+sql);
            
            db.transaction(function (tx) {
                tx.executeSql(sql, [], function (tx, res) {
                    console.log(sql);
                    var message = "";
                    
                    if(res.rows.length > 0){
                        element.val(res.rows.item(0).value).trigger("change");
                    }
                });
            });
        });

        // Fetch all tags and display them in the tags list
        displayTags();
        
        // Get current tag count
        getTagCount();
    });
    
    // Get from the server the list of materials and finishings
    wsGetTagMaterials();
    wsGetTagFinishings();
}

function testDatabase() {
    var db = sqlitePlugin.openDatabase({name: "accuform.tags", location: 1, androidLockWorkaround: 1});//window.sqlitePlugin.openDatabase({name: "accuform.tags", location: 1, androidLockWorkaround: 1});
    console.log("database test has started");
    db.transaction(function (tx) {
        tx.executeSql('DROP TABLE IF EXISTS test_table');
        tx.executeSql('CREATE TABLE IF NOT EXISTS test_table (id integer primary key, data text, data_num integer)');

        // demonstrate PRAGMA:
        db.executeSql("pragma table_info (test_table);", [], function (res) {
            console.log("PRAGMA res: " + JSON.stringify(res));
        });

        tx.executeSql("INSERT INTO test_table (data, data_num) VALUES (?,?)", ["test", 100], function (tx, res) {
            console.log("insertId: " + res.insertId + " -- probably 1");
            console.log("rowsAffected: " + res.rowsAffected + " -- should be 1");

            db.transaction(function (tx) {
                tx.executeSql("select count(id) as cnt from test_table;", [], function (tx, res) {
                    console.log("test_table has values");
                    console.log("res.rows.length: " + res.rows.length + " -- should be 1");
                    console.log("res.rows.item(0).cnt: " + res.rows.item(0).cnt + " -- should be 1");
                });
            });

        }, function (e) {
            console.log("ERROR: " + e.message);
        });
    });
}

function clearMainScreen() {
    deleteAllTags();
    $("#home input:not(.persistent)").each(function(){
        $(this).val("");
    });
    //$("#distributor").trigger("change");
    displayTags();
}

function deleteAllTags(){
    var db = sqlitePlugin.openDatabase({name: "accuform.tags", location: 1, androidLockWorkaround: 1});//window.sqlitePlugin.openDatabase({name: "accuform.tags", location: 1, androidLockWorkaround: 1});
    var delete_finishings = "DELETE FROM "+tags_finishings_table+";";
    var delete_tags = "DELETE FROM "+tags_table+";";
    db.transaction(function (tx) {
        tx.executeSql(delete_tags, [], function (tx, res) {});
        tx.executeSql(delete_finishings, [], function (tx, res) {});
    });
}

function clearAllData(){
    clearMainScreen();
    $("#home #tags-container").html("");
    toggleButtons(0);
    
    var db = sqlitePlugin.openDatabase({name: "accuform.tags", location: 1, androidLockWorkaround: 1});//window.sqlitePlugin.openDatabase({name: "accuform.tags", location: 1, androidLockWorkaround: 1});
    var delete_finishings = "DELETE FROM "+tags_finishings_table+";";
    var delete_tags = "DELETE FROM "+tags_table+";";
    var delete_settings = "DELETE FROM "+settings_table+" WHERE id NOT IN ("+settings_table_values.persistent.join()+");";
    db.transaction(function (tx) {
        tx.executeSql(delete_finishings, [], function (tx, res) {});
        tx.executeSql(delete_tags, [], function (tx, res) {});
        tx.executeSql(delete_settings, [], function (tx, res) {});
    });
}

function getDatabase() {
    db = sqlitePlugin.openDatabase({name: "accuform.tags", location: 1, androidLockWorkaround: 1});//window.sqlitePlugin.openDatabase({name: "accuform.tags", location: 1, androidLockWorkaround: 1});
    console.log(JSON.stringify(db));
}

function wsWakeUp(){
    if(onlineFlag === false){
        return;
    }
    
    console.log("wsWakeUp");
    $.ajax({
            url: host + "api/web/tags/v1/countries",
            dataType: 'json',
        });
}

function wsGetTagMaterials(){
    console.log("wsGetTagMaterials");
    active_materials = [];
    if(onlineFlag === true){
        console.log("wsGetTagMaterials from WS");
        $.ajax({
                url: host + "api/web/tags/v1/materials",
                dataType: 'json',
            })
        .done(function (materials) {
            active_materials = materials;
            harcodedMaterials = false;
            console.log("wsGetTagMaterials from WS fetched these: "+JSON.stringify(materials));
            
            var db = sqlitePlugin.openDatabase({name: "accuform.tags", location: 1, androidLockWorkaround: 1});//window.sqlitePlugin.openDatabase({name: "accuform.tags", location: 1, androidLockWorkaround: 1});
            var insertSql = "INSERT OR REPLACE INTO "+ws_tag_materials_table+" (id, name) VALUES ";
            
            for (i = 0; i < materials.length; i++) {
                var material = materials[i];
                insertSql += "("+material.id+", '"+material.name+"')" + (i < materials.length-1 ? ", " : ";");
            }
            
            console.log("wsGetTagMaterials from WS sql: "+insertSql);

            db.transaction(function (tx) {
                tx.executeSql("DELETE FROM "+ws_tag_materials_table, [], function (tx, res) {
                    console.log("wsGetTagMaterials DELETE FROM table result: "+JSON.stringify(res));
                });
                tx.executeSql(insertSql, [], function (tx, res) {
                    console.log("wsGetTagMaterials from WS sql. result: "+JSON.stringify(res));
                });
            });
        });
    }else{
        console.log("wsGetTagMaterials from DB");
        
        var db = sqlitePlugin.openDatabase({name: "accuform.tags", location: 1, androidLockWorkaround: 1});
        var sql = "SELECT * FROM "+ws_tag_materials_table+";";
        
        db.transaction(function (tx) {
            tx.executeSql(sql, [], function (tx, res) {
                if(res.rows.length > 0){
                    console.log("wsGetTagMaterials from DB fetched items");
                    for (i = 0; i < res.rows.length; i++) {
                        var material = res.rows.item(i);
                        active_materials.push(material);
                    }
                    console.log("wsGetTagMaterials from DB fetched these: "+JSON.stringify(active_materials));
                    harcodedMaterials = false;
                }else{
                    active_materials = [
                        {"id":6,"name":"PF-Cardstock (10-mil)"},
                        {"id":7,"name":"RP-Plastic (15-mil)"},
                        {"id":8,"name":"HS-Laminate (24-mil)"},
                        {"id":9,"name":"Tyvek &#153;"},
                        {"id":10,"name":"Self-Laminating PF Cardstock"},
                        {"id":11,"name":"Site-Tag &#174;"},
                        {"id":12,"name":"Self-Laminating RP-Plastic"},
                        {"id":13,"name":"Fluorescent RV-Plastic Tags (15-mil)"},
                        {"id":14,"name":"RS-Flexcard (9-mil)"},
                        {"id":15,"name":"Self-Laminating RS-Flexcard"}
                    ];
                    harcodedMaterials = true;
                    console.log("wsGetTagMaterials from DB There are no materials saved in the DB. Harcode them for now. ");
                }
            });
        });
    }
}

function wsGetTagFinishings(){
    console.log("wsGetTagFinishings");
    active_finishings = [];
    if(onlineFlag === true){
        console.log("wsGetTagFinishings from WS");
        $.ajax({
                url: host + "api/web/tags/v1/finishings",
                dataType: 'json',
            })
        .done(function (finishings) {
            active_finishings = finishings;
            harcodedFinishings = false;
            console.log("wsGetTagFinishings from WS fetched these: "+JSON.stringify(finishings));
            
            var db = sqlitePlugin.openDatabase({name: "accuform.tags", location: 1, androidLockWorkaround: 1});//window.sqlitePlugin.openDatabase({name: "accuform.tags", location: 1, androidLockWorkaround: 1});
            var insertSql = "INSERT OR REPLACE INTO "+ws_tag_finishings_table+" (id, name, is_range) VALUES ";
            
            for (i = 0; i < finishings.length; i++) {
                var finishing = finishings[i];
                insertSql += "("+finishing.id+", '"+finishing.name+"', "+finishing.is_range+")" + (i < finishings.length-1 ? ", " : ";");
            }
            
            console.log("wsGetTagFinishings from WS sql: "+insertSql);

            db.transaction(function (tx) {
                tx.executeSql("DELETE FROM "+ws_tag_finishings_table, [], function (tx, res) {
                    console.log("wsGetTagFinishings DELETE FROM table result: "+JSON.stringify(res));
                });
                tx.executeSql(insertSql, [], function (tx, res) {
                    console.log("wsGetTagFinishings from WS sql. result: "+JSON.stringify(res));
                });
            });
        });
    }else{
        console.log("wsGetTagFinishings from DB");
        
        var db = sqlitePlugin.openDatabase({name: "accuform.tags", location: 1, androidLockWorkaround: 1});
        var sql = "SELECT * FROM "+ws_tag_finishings_table+";";
        
        db.transaction(function (tx) {
            tx.executeSql(sql, [], function (tx, res) {
                if(res.rows.length > 0){
                    console.log("wsGetTagFinishings from DB fetched items");
                    for (i = 0; i < res.rows.length; i++) {
                        var finishing = res.rows.item(i);
                        active_finishings.push(finishing);
                    }
                    console.log("wsGetTagFinishings from DB fetched these: "+JSON.stringify(active_finishings));
                    harcodedFinishings = false;
                }else{
                    active_finishings = [
                        {"id":1,"name":"Plastic Twist Ties (Installed)","is_range":0},
                        {"id":2,"name":"String Ties (Installed)","is_range":0},
                        {"id":3,"name":"Wire Ties (Installed)","is_range":0},
                        {"id":4,"name":"Small Metal Grommet (1/4\")","is_range":0},
                        {"id":5,"name":"Standard Metal Grommet (3/8\")","is_range":0},
                        {"id":6,"name":"Large Metal Grommet (5/8\")","is_range":0},
                        {"id":7,"name":"Plastic (Black) Grommet (1/2\")","is_range":0},
                        {"id":8,"name":"Perforation","is_range":0,"active":1},
                        {"id":9,"name":"Consecutive Numbering","is_range":1}
                    ];
                    harcodedFinishings = true;
                    console.log("wsGetTagFinishings from DB There are no finishings saved in the DB. Harcode them for now. ");
                }
            });
        });
    }
}

function removeErrorStyle(pageId){
    $(".required-error", pageId).each(function(){
        $(this).removeClass("required-error");
    });
}

function dataIsValid(pageId){
    removeErrorStyle(pageId);
    
    var invalidFields = 0;    
    $("input[required=required], select[required=required]", pageId).each(function(){
        var value = $(this).val();
        if(value === ""){
            invalidFields++;
            $(this).parents(".ui-field-contain").first().addClass("required-error");
            
            if(invalidFields === 1){
                $(this).parents(".ui-field-contain").first().focus();
                $(this).focus();
            }
        }
    });
    
    return invalidFields > 0 ? false : true;
}

function displayFinishingsByTagId(tag_id) {
    var db = sqlitePlugin.openDatabase({name: "accuform.tags", location: 1, androidLockWorkaround: 1});//window.sqlitePlugin.openDatabase({name: "accuform.tags", location: 1, androidLockWorkaround: 1});
    var sql = "SELECT finishing_id FROM " + tags_finishings_table + " WHERE tag_id=" + tag_id + ";";
    db.transaction(function (tx) {
        tx.executeSql(sql, [], function (tx, res) {
            if (res.rows.length > 0) {
                var finishings = [];
                for (i = 0; i < res.rows.length; i++) {
                    var pair = res.rows.item(i);
                    finishings.push(pair.finishing_id);
                }
                $( "select#tag-finishing" ).val(finishings);
            }else{
                $( "select#tag-finishing" ).val("");
            }
            
            $( "select#tag-finishing").selectmenu('refresh', true);
        });
    });
}

function win(r) {
    pendingPictures--;
    console.log("Picture Upload Succes Response = " + r.response);
    if(pendingPictures <= 0){
        navigator.geolocation.getCurrentPosition(positionOnSuccess, positionOnSuccess);
    }
}

function fail(error) {
    pendingPictures--;
    console.log("Picture Upload An error has occurred: Error = " + JSON.stringify(error));
    if(pendingPictures <= 0){
        navigator.geolocation.getCurrentPosition(positionOnSuccess, positionOnSuccess);
    }
}

var pendingPictures = 0;
function uploadPicture(fileURL, name){
    console.log("UploadPicture: name "+name+", path "+fileURL);
    var extension = fileURL.substr(fileURL.lastIndexOf("."));
    var mimeType = extension === ".png" ? "image/png" : "image/jpeg";
    
    var options = new FileUploadOptions();
    options.fileKey = "file";
    options.fileName = name ? name+extension : fileURL.substr(fileURL.lastIndexOf('/') + 1);
    options.mimeType = mimeType;
    
    var params = {};
    params.sales_person_email = sales_person_email;
    params.value2 = "param";

    options.params = params;

    var ft = new FileTransfer();
    ft.upload(fileURL, encodeURI(host + "api/web/tags/v1/quotes/upload"), win, fail, options);
}

var quoteObject = {};
var sales_person_email = "";
var fields = [];
function sendAllData(){
    // Declare empty array to hold all task related fields in it
    fields = [];
    
    // Sales Person
    fields.push({"name": "sales_person", "value": $("input#sales_person_name").val()});
    
    // Sales Person Email
    sales_person_email = $("input#sales_person_email").val();
    fields.push({"name": "sales_person_email", "value": $("input#sales_person_email").val()});
    
    // Distributor
    fields.push({"name": "distributor_name", "value": $("input#distributor").val()});
//    if(typeof($("input#distributor").attr("data-db-reference")) !== "undefined" && $("input#distributor").attr("data-db-reference") !==""){
//        fields.push({"name": "distributor_id", "value": $("input#distributor").attr("data-db-reference")});
//    }else{
//        fields.push({"name": "distributor_name", "value": $("input#distributor").val()});
//    }
    
    // Distributor Contact
    fields.push({"name": "distributor_contact", "value": $("input#distributor_contact").val()});
    
    // Distributor Email
    fields.push({"name": "distributor_email", "value": $("input#distributor_email").val()});
    
    // End-User
    fields.push({"name": "end_user", "value": $("input#end_user").val()});
    
    // End-User Contact
    fields.push({"name": "end_user_contact", "value": $("input#end_user_contact").val()});
    
    // End-User Email
    fields.push({"name": "end_user_email", "value": $("input#end_user_email").val()});
    
    console.log(fields);
        
    // Tags
    var db = sqlitePlugin.openDatabase({name: "accuform.tags", location: 1, androidLockWorkaround: 1});//window.sqlitePlugin.openDatabase({name: "accuform.tags", location: 1, androidLockWorkaround: 1});
    var sql = "SELECT * FROM "+tags_table+" LEFT JOIN "+tags_finishings_table+" ON "+tags_finishings_table+".tag_id = "+tags_table+".id ORDER BY "+tags_table+".id DESC;";
    db.transaction(function (tx) {
        tx.executeSql(sql, [], function (tx, res) {
            pendingPictures = 0;
            if(res.rows.length > 0){
                var tagsArray = [];
                for (i = 0; i < res.rows.length; i++) {
                    var tag = res.rows.item(i);
                    
                    // If this tag was already added to the reference array, update only the finishings values
                    if($.grep(tagsArray, function(e){ return e.local_id === tag.id; }).length === 0){
                        pendingPictures = pendingPictures + 2;
                        // Send all pictures to WS
                        if(tag.photo_front !== null && tag.photo_front !== ""){
                            uploadPicture(tag.photo_front, "Tag_"+ (tag.id)+"_Front");
                        }else{
                            pendingPictures--;
                        }

                        if(tag.photo_back !== null && tag.photo_back !== ""){
                            uploadPicture(tag.photo_back, "Tag_"+ (tag.id)+"_Back");
                        }else{
                            pendingPictures--;
                        }

                        // Get all the finishing added to the current tag
                        var tagObject ;
                        tagObject = {
                            "annual_usage": tag.annual_usage,
                            "finishing_range_end": tag.finishing_range_end,
                            "finishing_range_start": tag.finishing_range_start,
                            "finishings": [],
                            "local_id": tag.id,
                            "material_id": tag.material_id,
                            "name": tag.name,
                            "notes": tag.notes,
                            "quantity": tag.quantity,
                            "size_height": tag.size_height,
                            "size_width": tag.size_width,
                            "size_unit": tag.size_unit,
                        };
                        if(tag.finishing_id !== null && tag.finishing_id !== ""){
                            tagObject.finishings.push(tag.finishing_id);
                        }
                        tagsArray.push(tagObject); 
                    }else if($.grep(tagsArray, function(e){ return e.local_id === tag.id; }).length > 0 && tag.finishing_id !== null && tag.finishing_id !== ""){
                        $.each(tagsArray, function() {
                            if (this.local_id === tag.id && $.inArray(tag.finishing_id, this.finishings) === -1) {
                                this.finishings.push(tag.finishing_id);
                            }
                        });
                    }
                }
                
                // Send all quote data to WS
                fields.push({"name": "tags", "value": tagsArray});
                
                if(pendingPictures === 0){
                    navigator.geolocation.getCurrentPosition(positionOnSuccess, positionOnSuccess);
                }
            }
        });
    });
}


var positionOnSuccess = function(position) {
    fields.push({"name": "latitude", "value": position.coords.latitude});
    fields.push({"name": "longitude", "value": position.coords.longitude});
    
    console.log('Latitude: '          + position.coords.latitude          + '\n' +
          'Longitude: '         + position.coords.longitude         + '\n' +
          'Altitude: '          + position.coords.altitude          + '\n' +
          'Accuracy: '          + position.coords.accuracy          + '\n' +
          'Altitude Accuracy: ' + position.coords.altitudeAccuracy  + '\n' +
          'Heading: '           + position.coords.heading           + '\n' +
          'Speed: '             + position.coords.speed             + '\n' +
          'Timestamp: '         + position.timestamp                + '\n');
  
    wsCompleteRequest();
};

function positionOnError(error) {
    console.log('positionOnError - code: '    + error.code    + '\n' +
          'message: ' + error.message + '\n');
    
    wsCompleteRequest();
}

var wsCompleteRequestRunning = false;
function wsCompleteRequest(){
    if(wsCompleteRequestRunning === true){
        return;
    }
    wsCompleteRequestRunning = true;
    
    if (fields.length > 0) {
        var quoteObject = {};
        for (var i = 0; i < fields.length; i++) {
            var fieldName = fields[i].name;
            var fieldValue = fields[i].value;
            quoteObject[fieldName] = fieldValue;
        }
    }
    
    console.log("wsCompleteRequest with data "+JSON.stringify(quoteObject));
    $.ajax({
        type: "POST",
        url: host + "api/web/tags/v1/quotes/test",
        dataType: "json",
        data: {Quote: quoteObject},
        crossDomain: true
    })
    .done(function(data) {
        console.log(data);
        navigator.notification.alert("Quote was sent successfully to "+sales_person_email+". Data was cleared and a new one can be created.", function(){}, "Success");
        clearAllData();
    })
    .fail(function( jqXHR, textStatus ) {
        console.log("wsCompleteRequest Request failed: " + textStatus );
    })
    .always(function() {
        wsCompleteRequestRunning = false;
        sales_person_email = "";
        $.mobile.loading("hide");
    });
}

function toggleButtons(tagsCount){
    if(tagsCount > 0){
        $("#home .add-tag.add-first-tag").removeClass("add-first-tag").text("ADD MORE");
        //$("#submit-quote.hidden").removeClass("hidden").addClass("visible").show();
        toggleSubmitButton(true);
        showSubmit = true;
    }else{
        $("#home .add-tag:not(.add-first-tag)").addClass("add-first-tag").text("ADD TAG");
        //$("#submit-quote.visible").removeClass("visible").addClass("hidden").hide();
        toggleSubmitButton(false);
        showSubmit = false;
    }
}

function toggleSubmitButton(toggle){
    if(toggle === true && onlineFlag === true){
        $("#submit-quote.hidden").removeClass("hidden").addClass("visible").show();
    }else if (toggle === false){
        $("#submit-quote.visible").removeClass("visible").addClass("hidden").hide();
    }
}