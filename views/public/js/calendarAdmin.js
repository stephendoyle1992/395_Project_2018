function fieldCheck(input) {
	if (input.value == "" ) {
		makeToast('error', `${input.name} cannot be empty`)
		input.classList.add('alert');
		input.classList.add('alert-danger');
		return true;
	}

	input.classList.remove('alert');
	input.classList.remove('alert-danger');
	return false;
}

// Callback function for drag/drops and resizes of existing events
// Note: We dont want this to be populated if we aren't admin.
// post-demo will refactor this out into templates populated differently based on the role of the user
function showModal(btn) {
    let event = $('#calendar').fullCalendar('clientEvents', btn.getAttribute("data-id"))[0]; // get event from returned array
    // Make open/closing button tags which allows us to insert  the current data as the btton text
    let openEditNoteButton = "<button type='button' class='btn btn-outline-secondary border-0 mpb-1' "
            + "data-fieldName='note' onclick='editEventDetails(this)' data-id='"
            + event.id + "'>";
    // Need another prefix tag for title
    let openEditTitleButton = "<button type='button' class='btn btn-outline-secondary border-0 mpb-1' "
        + "data-fieldName='title' onclick='editEventDetails(this)' data-id='"
        + event.id + "'>";

    let closeEditButton = "    <span class='far fa-edit fa-lg'></span></button>"; // close the edit button

    let editCapacityButton = "<button type='button' class='btn btn-outline-secondary border-0 mpb-1' "
        + "data-fieldName='capacity' onclick='editEventDetails(this)' data-id='"
        + event.id + "'>" + closeEditButton;

    // use the open/close button strings to create edit buttons containing the data to be altered
    $('#eventModalTitle').html(openEditTitleButton + "<h5>" + event.title + closeEditButton + "</h5>");
    $('#modalEventRoom').html(event.room + " Room").css("color", event.color);

    $('#modalEventTime').html(event.start.format("ddd, hh:mm") + " - " + event.end.format("hh:mm"))
    $('#modalEventCapacity').html("<h5> Capacity   " + event.capacity + editCapacityButton + "</h5>");

    let hourlyValue = moment.duration(event.end.diff(event.start)).asHours() * event.modifier;
    $('#modalValueLabel').append("<button type='button' class='btn btn-outline-secondary border-0 mpb-1' "
        + "data-fieldName='modifier' onclick='editEventDetails(this)' data-id='"
        + event.id + "'>" + "modifier: " + event.modifier + closeEditButton).append("<h5 id='modalEventValue' class='text-primary'>" + hourlyValue + "</h5>");
    $('#eventNote').html(openEditNoteButton + "<p class='text-muted'>" + event.note + closeEditButton + "</p>");

    // button to add a booking to the event
    let bookingBtn = "<button type='button' class='btn-outline-success border-0 btn-sm' data-uid='-1' data-id='" + event.id + "' onclick='requestBookingWrapper(this)'><span class='fas fa-user-plus fa-2x'></span></button>  ";
    $('#modalBookedLabel').append("  " + bookingBtn)

    // make a button for each user (so they can be unbooked easily and clearly... unlike this code hehe)
    let bookingsHTML = "";
    let len = (!event.bookings) ? 0 : event.bookings.length;
    if (len === 0) {
        bookingsHTML = "No bookings yet";
    }
    for (let i = 0; i < len; i++) {
        bookingsHTML += "<button type='button' class='btn btn-outline-danger border-0 mp-1 mt-2' data-uid='"
            + event.bookings[i].userId
            + "' data-id='" + event.id
            + "' onclick='requestBookingWrapper(this)'>"
            + event.bookings[i].userName + "        "
            + "<span class='fas fa-minus-circle fa-lg'></span></button>";
    }

    $('#eventBookings').html(bookingsHTML); // set event bookings with the html built in the loop
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
        modifier: event.modifier,
        capacity: event.capacity
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
            makeToast("success", data.msg);
        },
        error: function(xhr, ajaxOptions, thrownError) {
            if (!!revertFunc) {
                revertFunc();
            }
            makeToast("error", "Request failed: " + xhr.responseText);
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
        uid = prompt("Please enter the userID to book in this event: ");
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
            makeToast("success", data.msg);
			event = $('#calendar').fullCalendar('clientEvents', event.id)[0]; // get calendar event
			console.log(event);
			console.log(event.booked);
            event.booked = !event.booked;
            if (event.booked == true) {
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
			$('#calendar').fullCalendar('refetchEvents');
			updateEventRefreshModal(event, btn);
        },
        error: function(xhr, ajaxOptions, thrownError) {
            makeToast("error", "Booking request failed: " + xhr.responseText);
        }
    });
}

function updateEventRefreshModal(event, btn) {
    $('#calendar').fullCalendar('updateEvent', event);
    $('#eventDetailsModal').one('hidden.bs.modal', function(e) {
        showModal(btn);
    }) .modal('hide');
}

function editEventDetails(btn) {
    let event = $('#calendar').fullCalendar('clientEvents', btn.getAttribute("data-id"))[0];
    let field = btn.getAttribute("data-fieldName");

    /*
     * Gross nested if-elses... just a bunch of error checking with slightly different edge case checking
     * Basically we can have empty notes, but we warn; cannot have empty title so throw error
     * If numeric notes/title, we make change but show warning.
     * If cancel is clicked (only matter for notes because can be empty) --> we leave silently [for title we throw an error toast b/c can't have empty title so cancel is covered]
     * Lastly, we client-side validate the modifier value
     */
    if (field === "title") {
        temp = prompt("Enter the new title: ");
        if (temp === null || temp === "" || temp === undefined) {
            makeToast("error", "Cannot have empty title");
            return;
        } else if (!isNaN(temp)) {
            makeToast("warning", "The new title is a number, is that a typo?");
        }
        event.title = temp;
    } else if (field === "room") {
        temp = prompt("Enter the new room name (expecting a color): ")
        if (temp !== null || temp !== "" || temp !== undefined) {
            event.room = temp;
            event.color = temp;
        } else {
            makeToast("error", "Must be a valid colour");
        }
    }  else if (field === "note") {
        temp = prompt("Enter the new description: ");
        if (temp === null) {
            return;
        } else if (temp === "") {
            makeToast("warning", "You left the description field empty, was that on purpose?")
        } else if (!isNaN(event.note)) {
            makeToast("warning", "The new description is numeric, was that on purpose?");
        }
        event.note = temp;
    } else if (field == "modifier") {
        temp = parseFloat(prompt("Enter the new multiplier value: "));
        if (isNaN(temp)) {
            makeToast("error", "Modifier must be a number!");
            return
        }
        event.modifier = temp;
    } else if (field == "capacity") {
        temp = parseFloat(prompt("Enter the new capacity: "));
        if (isNaN(temp)) {
            makeToast("error", "Capacity must be a number!");
            return
        }
        event.capacity = temp;
    } else {
        makeToast("error", "An unpredicted error occurred");
        return
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
            makeToast("success", data.msg);
        },
        error: function(xhr, ajaxOptions, thrownError) {
            makeToast("error", "Request failed: " + xhr.responseText);
        }
    });
    // remove event from calendar
    $('#calendar').fullCalendar('removeEvents', event.id);
}

$(document).ready(function() {


    // ensure created button is deleted on modal close
    $('#eventDetailsModal').on('hide.bs.modal', function (e) {
        $('#modalNoteLabel').html("Description:");
        $('#modalBookedLabel').html("Attending:");
        $('#modalValueLabel').html("Value:");
    });

    // page is now ready, initialize the calendar...
    $('#calendar').fullCalendar({
        weekends: false,
        header: {
            left: 'today',
            center: 'prev, title, next',
            right: 'agendaWeek, month'
        },
        snapDuration: "00:05:00",
        agendaEventMinHeight: 90,
        defaultView: "agendaWeek",
        contentHeight: 'auto',
        events: "/api/v1/events/scheduler",    // link to events (bookings + blocks feed)
        allDayDefault: false,        // blocks are not all-day unless specified
        themeSystem: "bootstrap4",
        editable: true,                 // Need to use templating engine to change bool based on user's rolego ,
        eventRender: function(event, element, view) {
            event.capacity = ((!!event.capacity) ? event.capacity : "3");
            element.find('.fc-time').css("font-size", "1rem")
                    .append('   -   ' + event.bookingCount.toString() + "/" + event.capacity.toString());
            element.find('.fc-title').css("font-size", "0.85rem").append("<br>")
                    .append("<button type='button' class='btn btn-outline-primary border-0 btn-sm' data-id='" + event.id + "' onclick='showModal(this)'><i class='far fa-edit'></i></button>")
                    .append("<button type='button' class='btn btn-outline-primary border-0 btn-sm' data-id='" + event.id + "' onclick='removeEvent(this)'><i class='fas fa-times-circle'></i></button>");
            return renderFiltered(event);
         },
        // DOM-Event handling for Calendar Eventblocks (why do js people suck at naming)
        eventOverlap: function(stillEvent, movingEvent) {
            if (stillEvent.color === movingEvent.color) {
                makeToast("warning", "Events of same color may not overlap");
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
    xhttp.open("GET", "/api/v1/admin/classes")
    xhttp.send();
}

function submitEvent() {

	let startD = document.querySelector("#startdate");
	let startT = document.querySelector("#starttime");
	let endD = document.querySelector("#enddate");
    let endT = document.querySelector("#endtime");
    let room = document.querySelector("#room");
	let mod = document.querySelector("#modifier");
	let rep = parseInt(document.querySelector("#repeatOption").value);
	let endRep = document.querySelector("#repeatDate");

	if (fieldCheck(startD) || fieldCheck(startT)
	|| fieldCheck(endD) || fieldCheck(endT)
	|| fieldCheck(room) || fieldCheck(mod)) {
		return;
	}


	if (rep != 0 && endRep == "") {
		makeToast('error','Please fill out a repeat interval');
		return;
	}


    let xhttp = new XMLHttpRequest();
    xhttp.addEventListener("loadend", () => {
        if (xhttp.status > 300) {
            makeToast("error", 'Could not create event.');
            return;
        }
        //loadAddEvent();
    });
    let tzone = new Date().getTimezoneOffset();
    let event = {}
    event.title = $("#bTitle").val();
	event.title = ((event.title === "" || !event.title) ? "Facilitation" : event.title);
    event.start = moment(`${document.querySelector("#startdate").value}T${document.querySelector("#starttime").value}`).format();
	event.end = moment(`${document.querySelector("#enddate").value}T${document.querySelector("#endtime").value}`).format();
    event.roomId = parseInt(document.querySelector("#room").value);
    event.room = $("#room option:selected").text();
    event.modifier = parseFloat(document.querySelector("#modifier").value);
	event.capacity = parseInt(document.querySelector("#capacity").value);
    event.note = document.querySelector("#note").value;
	event.repeating = rep
	if (rep != 0) {
		event.repeatingDate = moment(`${endRep.value}`).format();
	}
	
	eventJson = JSON.stringify(event);
    // Make ajax POST request with booking request or request bookign delete if already booked
    $.ajax({
        url: '/api/v1/events/add',
        type: 'POST',
        contentType: 'json',
        data: eventJson,
        dataType: 'json',
        success: function (data) {
			if (event.repeating != 0) {
				makeToast('success','All events added!');
				$('#calendar').fullCalendar('refetchEvents');
				return;
			}
            event.id = data.id;
            event.color = data.color;
            event.bookingCount = 0;
            event.title = ((data.title) ? data.title : "Facilitation");
            $('#calendar').fullCalendar('renderEvent', event); // render event on calendar
            makeToast("success", "Created new event, ID: " + event.id + "!");
        },
        error: function (xhr, ajaxOptions, thrownError) {
            makeToast("error", "Request failed: " + xhr.responseText);
        }
    });
}