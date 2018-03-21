// Callback function for drag/drops and resizes of existing events
// Note: We dont want this to be populated if we aren't admin.
// post-demo will refactor this out into templates populated differently based on the role of the user

function showToaster(type, msg) {
    toastr.options = {
        "closeButton": true,
        "debug": false,
        "newestOnTop": true,
        "progressBar": false,
        "positionClass": "toast-top-right",
        "preventDuplicates": true,
        "onclick": null,
        "showDuration": "300",
        "hideDuration": "1000",
        "timeOut": "5000",
        "extendedTimeOut": "1000",
        "showEasing": "swing",
        "hideEasing": "linear",
        "showMethod": "fadeIn",
        "hideMethod": "fadeOut"
    };

    Command: toastr[type](msg);
}

function showModal(btn) {
    let event = $('#calendar').fullCalendar('clientEvents', btn.getAttribute("data-id"))[0]; // get event from returned array
    // Make open/closing button tags which allows us to insert  the current data as the btton text
    let openEditNoteButton = "<button type='button' class='btn btn-outline-secondary border-0 mpb-1' "
            + "data-fieldName='note' onclick='editNote(this)' + data-id='"
            + event.id + "'>";
    // Need another prefix tag for title
    let openEditTitleButton = "<button type='button' class='btn btn-outline-secondary border-0 mpb-1' "
        + "data-fieldName='title' onclick='editNote(this)' + data-id='"
        + event.id + "'>";

    let closeEditNoteButton = "    <span class='far fa-edit fa-lg'></span></button>"; // close the edit button
    // use the open/close button strings to create edit buttons containing the data to be altered
    $('#eventModalTitle').html(openEditTitleButton + "<h5>" + event.title + closeEditNoteButton + "</h5>");
    $('#modalEventRoom').html(event.room + " Room").css("color", event.color);
    $('#modalEventTime').html(event.start.format("ddd, hA") + " - " + event.end.format("hA"))
    $('#eventNote').html(openEditNoteButton + "<p class='text-muted'>" + event.note + closeEditNoteButton + "</p>");

    let len = (!event.bookings) ? 0 : event.bookings.length;
    let bookingsHTML = "";
    if (len === 0) {
        bookingsHTML = "No bookings yet <br> You could be the first!"
    }
    // button to add a booking to the event
    let bookingBtn = "<button type='button' class='btn-outline-success border-0 btn-sm' data-uid='-1' data-id='" + event.id + "' onclick='requestBookingWrapper(this)'><span class='fas fa-user-plus fa-2x'></span></button>  ";
    $('#modalBookedLabel').append("  " + bookingBtn)

    // make a button for each user (so they can be unbooked easily and clearly... unlike this code hehe)
    for (let i = 0; i < len; i++) {
        bookingsHTML += "<button type='button' class='btn btn-outline-danger border-0 mp-1 mt-2' data-uid='"
            + event.bookings[i].userId
            + "' data-id='" + event.id
            + "' onclick='requestBookingWrapper(this)'>"
            + event.bookings[i].userName + "        "
            + "<span class='fas fa-minus-circle fa-lg'></span></button>";
    }
    $('#eventBookings').html(bookingsHTML); // set event bookings with the html built in the loop

    // set color & text of submit button
    $('#modalConfirm').html("Submit")
        .removeClass("btn-primary")
        .addClass("btn-success");

    $('#eventDetailsModal').modal('show'); // spawn our modal
}

function storeChangesToEvent(event, delta, revertFunc, jsEvent, ui, view) {
    // Extract block data required for updating on server
    let temp = {
        id: event.id,
        start: event.start.format(),
        end:   event.end.format(),
        title: event.title,
        note:  event.note,
    };

    if (!temp.start.endsWith("Z")) { temp.start = temp.start + "Z"; }
    if (!temp.end.endsWith("Z")) { temp.end = temp.end + "Z"; }

    let event_json = JSON.stringify(temp);
    // Make ajax post request with updated event data
    $.ajax({
        url: '/api/v1/events/update',
        type: 'POST',
        contentType:'json',
        data: event_json,
        dataType:'json',
        success: function(data) { 
            showToaster("success", data.msg);
        },
        error: function(xhr, ajaxOptions, thrownError) {
            if (!!revertFunc) {
                revertFunc();
            }
            showToaster("error", "Request failed: " + xhr.responseText);
        }
    });
}


/*
 * Adds a booking from the event being viewed (modal holds data)
 */
function requestBookingWrapper(btn) {
    let event = $('#calendar').fullCalendar('clientEvents', btn.getAttribute("data-id"))[0];
    event.booked = true; // assume deleting prior to uid check

    let uid = btn.getAttribute("data-uid");
    if (uid == -1) { // We use a == because incoming type may be a string
        uid = prompt("Please enter the userID or username to book in this event: ");
        temp = parseInt(uid);
        if (typeof temp === "number") {
            uid = temp;
        }
        event.booked = false;
    } else {
        uid = parseInt(uid);
    }
    requestBooking(event, uid, btn);
}

/*
 * makes a request with the json given to the booking request route
 * with the given uid
 *
 *  btn given so we can refresh modal
 */
function requestBooking(event, uid, btn) {
    // Block info for booking
    let booking_json = JSON.stringify({
        id:         event.id,
        start:      event.start,
        end:        event.end,
        userId:     uid,
    });

    $.ajax({
        url: '/api/v1/events/book',
        type: 'POST',
        contentType:'json',
        data: booking_json,
        dataType:'json',
        success: function(data) {  // We expect the server to return json data with a msg field
            // noinspection Annotator
            showToaster("success", data.msg);
            event = $('#calendar').fullCalendar('clientEvents', event.id)[0]; // get calendar event
            event.booked = !event.booked;
            if (event.booked === true) {
                if (!event.bookings) {
                    event.bookings = [];
                }
                // noinspection Annotator
                event.bookings.push({userName: data.userName, userId: data.userId});
                event.bookingCount++;
            } else {
                // noinspection Annotator
                event.bookingCount--;
                let len = event.bookings.length;
                for (let i = 0; i < len; i++) {
                    if (event.bookings[i].userId == data.userId) {
                        event.bookings.splice(i, 1);
                        break;
                    }
                }
            }
            updateEventRefreshModal(event, btn);
        },
        error: function(xhr, ajaxOptions, thrownError) {
            showToaster("error", "Booking request failed: " + xhr.responseText);
        }
    });
}

function updateEventRefreshModal(event, btn) {
    $('#calendar').fullCalendar('updateEvent', event);
    $('#eventDetailsModal').one('hidden.bs.modal', function(e) {
        showModal(btn);
    }) .modal('hide');
}

function editNote(btn) {
    let event = $('#calendar').fullCalendar('clientEvents', btn.getAttribute("data-id"))[0];
    let field = btn.getAttribute("data-fieldName");
    if (field === "title") {
        event.title = prompt("Enter the new title: ");
    } else if (field === "note") {
        event.note = prompt("Enter the new description: ");
    }
    storeChangesToEvent(event);
    updateEventRefreshModal(event, btn)
}

// REmoves an event from the calendar and the associated TB/Bookings from the database
function removeEvent(btn) {
    let event = $('#calendar').fullCalendar('clientEvents', btn.getAttribute("data-id"))[0];
    yn = confirm("Are you sure you want to delete this event?")
    if (!yn) {
        return false; // event should not be deleted
    }
    let event_json = JSON.stringify({
        id:    event.id,
    });
    // Make ajax post request with updated event data
    $.ajax({
        url: '/api/v1/events/delete',
        type: 'POST',
        contentType:'json',
        data: event_json,
        dataType:'json',
        success: function(data) {
            showToaster("success", data.msg);
        },
        error: function(xhr, ajaxOptions, thrownError) {
            showToaster("error", "Request failed: " + xhr.responseText);
        }
    });
    // remove event from calendar
    $('#calendar').fullCalendar('removeEvents', event.id);
}

$(document).ready(function() {
    loadAddEvent();

    // ensure created button is deleted on modal close
    $('#eventDetailsModal').on('hide.bs.modal', function (e) {
        $('#modalNoteLabel').html("Description:");
        $('#modalBookedLabel').html("Attending:");
    })

    // page is now ready, initialize the calendar...
    $('#calendar').fullCalendar({
        // Education use (both now and if deployed!)
        weekends: false,
        header: {
            left: 'today',
            center: 'prev, title, next',
            right: 'agendaWeek, month'
        },
        agendaEventMinHeight: 100,
        defaultView: "agendaWeek",
        contentHeight: 'auto',
        events: "/api/v1/events/scheduler",    // link to events (bookings + blocks feed)
        allDayDefault: false,        // blocks are not all-day unless specified
        themeSystem: "bootstrap4",
        editable: true,                 // Need to use templating engine to change bool based on user's rolego ,
        eventRender: function(event, element, view) {
            element.find('.fc-time').css("font-size", "1em")
                    .append("   " + event.bookingCount + "/3<br>");
            element.find('.fc-title').css("font-size", "1.2em").append("<br>")
                    .append("<button type='button' class='btn btn-outline-primary border-0 btn-sm' data-id='" + event.id + "' onclick='showModal(this)'><i class='far fa-edit fa-lg'></i></button>    ")
                    .append("<br><button type='button' class='btn btn-outline-primary border-0 btn-sm' data-id='" + event.id + "' onclick='removeEvent(this)'><i class='fas fa-times-circle fa-lg'></i></button>    ");
        },
        // DOM-Event handling for Calendar Eventblocks (why do js people suck at naming)
        eventOverlap: function(stillEvent, movingEvent) {
            if (stillEvent.color === movingEvent.color) {
                showToaster("warning", "Events of same color may not overlap");
            }
            return stillEvent.color !== movingEvent.color;
        },
        // When and event is drag/dropped to new day/time --> updates db & stuff
        // revertFunc is called should our update request fail
        eventDrop: function(ev, delta, revertFunc, jsEvent, ui, view) {
            storeChangesToEvent(ev, delta, revertFunc, jsEvent, ui, view);
        },
        // When an event is resized (post duration change) it will callback the function
        // revertFunc is fullCalendar function which reverts the display should the request fail
        eventResize: function(ev, delta, revertFunc, jsEvent, ui, view) {
            storeChangesToEvent(ev, delta, revertFunc, jsEvent, ui, view);
        },
        businessHours: {
            // days of week. an array of zero-based day of week integers (0=Sunday)
            dow: [1, 2, 3, 4, 5], // Monday - Thursday
            start: '8:00', // a start time (10am in this example)
            end: '18:00', // an end time (6pm in this example)
        },
        // Controls view of agendaWeek
        minTime: '07:00:00',
        maxTime: '19:00:00',
        allDaySlot: false,       // shows slot @ top for allday events
        slotDuration: '00:30:00' // hourly divisions
    });
    $('.fc-today').css("background-color", "#FEFEFE");
    loadAddEvent();
});

function loadAddEvent() {
    let xhttp = new XMLHttpRequest();
    xhttp.addEventListener("loadend", () => {
        if (xhttp.response > 300) {
            alert("ERROR: Could not load class list");
        }
        let classes = JSON.parse(xhttp.response);
        let tmpl = document.querySelector("#tmpl_EventForm").innerHTML;
        let func = doT.template(tmpl);
        document.querySelector("#eventForm").innerHTML = func(classes);
        document.querySelector("#submit").addEventListener("click", submitEvent);
    });
    xhttp.open("GET", "http://localhost:8080/api/v1/admin/classes")
    xhttp.send();
}

function submitEvent() {
    if (document.querySelector("#start").value == ""
        || document.querySelector("#end").value == ""
        || document.querySelector("#room").value == ""
        || document.querySelector("#modifier").value == "") {
        alert('Please fill out all options');
        return;
    }

    let xhttp = new XMLHttpRequest();
    xhttp.addEventListener("loadend", () => {
        if (xhttp.status > 300) {
            showToaster("error", 'Could not create event.');
            return;
        }
        //loadAddEvent();
    });
    let event = {}
    event.start = moment(document.querySelector("#start").value).format();
    event.end = moment(document.querySelector("#end").value).format();
    event.room = document.querySelector("#room").value;
    event.color = event.room
    event.modifier = parseInt(document.querySelector("#modifier").value);
    event.note = document.querySelector("#note").value;
    eventJson = JSON.stringify(event);
    // Make ajax POST request with booking request or request bookign delete if already booked
    $.ajax({
        url: '/api/v1/events/add',
        type: 'POST',
        contentType: 'json',
        data: eventJson,
        dataType: 'json',
        success: function (data) {
            event.id = data.id;
            event.color = data.color;
            event.title = "Facilitation";
            $('#calendar').fullCalendar('renderEvent', event); // render event on calendar
        },
        error: function (xhr, ajaxOptions, thrownError) {
            showToaster("error", "Request failed: " + xhr.responseText);
        }
    });
}