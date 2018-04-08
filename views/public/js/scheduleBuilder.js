// Callback function for drag/drops and resizes of existing events
// Note: We dont want this to be populated if we aren't admin.
// post-demo will refactor this out into templates populated differently based on the role of the user
//
// TODO:
// Maybe make color change a dropdown select from combobox doohickey like familyname in donate / various things in admin stuff
// include max bookings change button (and to  calendarAdmin.js)
// include repeat interval editing abilities
// Change how date is displayed to only show the day/time (exclude the month/year)
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
    // use the open/close button strings to create edit buttons containing the data to be altered
    $('#eventModalTitle').html(openEditTitleButton + "<h5>" + event.title + closeEditButton + "</h5>");
    $('#modalEventRoom').html(event.room + " Room").css("color", event.color);
    $('#modalEventTime').html(event.start.format("ddd, hhA") + " - " + event.end.format("hA"))

    let hourlyValue = moment.duration(event.end.diff(event.start)).asHours() * event.modifier;
    $('#modalValueLabel').append("<button type='button' class='btn btn-outline-secondary border-0 mpb-1' "
        + "data-fieldName='modifier' onclick='editEventDetails(this)' data-id='"
        + event.id + "'>" + "modifier: " + event.modifier + closeEditButton).append("<h5 id='modalEventValue' class='text-primary'>" + hourlyValue + "</h5>");
    $('#eventNote').html(openEditNoteButton + "<p class='text-muted'>" + event.note + closeEditButton + "</p>");

    let len = (!event.bookings) ? 0 : event.bookings.length;
    let bookingsHTML = "";
    if (len === 0) {
        bookingsHTML = "No bookings yet <br> You could be the first!"
    }
    // set color & text of submit button
    $('#modalConfirm').html("Submit")
        .removeClass("btn-primary")
        .addClass("btn-success");

    $('#eventDetailsModal').modal('show'); // spawn our modal
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
    } else if (field === "note") {
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
    } else {
        makeToast("error", "An unpredicted error occurred");
        return
    }
    updateEventRefreshModal(event, btn)
}

// REmoves an event from the calendar and the associated TB/Bookings from the database
function removeEvent(btn) {
    let event = $('#calendar').fullCalendar('clientEvents', btn.getAttribute("data-id"))[0];
    yn = confirm("Are you sure you want to delete this event?")
    if (!yn) {
        return false; // event should not be deleted
    }
    // remove event from calendar
    $('#calendar').fullCalendar('removeEvents', event.id);
}

$(document).ready(function() {
    loadChangeTemplateEvent(); // Coordinate form to change template event onchange events

    // ensure created button is deleted on modal close
    $('#eventDetailsModal').on('hide.bs.modal', function (e) { // Need all fields
        $('#modalNoteLabel').html("Description:");
        $('#modalBookedLabel').html("Attending:");
        $('#modalValueLabel').html("Value:");
    });

    // page is now ready, initialize the calendar...
    $('#calendar').fullCalendar({
        weekends: true,
        header: {
          left: "",
          center: "",
          right: ""
        },
        views: {
            agendaFourDay: {
                type: 'agenda',
                dayCount: 6,
            }
        },
        events: [
            {
                title: "Facilitation",
                start: moment().day(0).hour(9),
                end: moment().day(0).hour(11),
                capacity: 3,
                modifier: 1,
                note: "template block!",
                room: 'black',
                color: "black",
            }
        ],
        agendaEventMinHeight: 90,
        defaultView: "agendaFourDay",
        contentHeight: 'auto',
        allDayDefault: false,        // blocks are not all-day unless specified
        themeSystem: "bootstrap4",
        editable: true,                 // Need to use templating engine to change bool based on user's rolego ,
        columnHeaderText: (now => {return ((now.day() === 0) ? "Template Day" : now.format("dddd")); }),
        eventRender: function(event, element, view) {
            event.capacity = ((!!event.capacity) ? event.capacity : "3");
            element.find('.fc-time').css("font-size", "1rem")
                .append('     0/' + event.capacity);
            let title = element.find('.fc-title');
            title.css("font-size", "1.2rem").append("<br>")
                .append("<button type='button' class='btn btn-outline-primary border-0 btn-sm' data-id='" + event.id + "' onclick='showModal(this)'><i class='far fa-edit fa-lg'></i></button>    ");
            if (event.start.day() > 0) {
                title.append("<br><button type='button' class='btn btn-outline-primary border-0 btn-sm' data-id='" + event.id + "' onclick='removeEvent(this)'><i class='fas fa-times-circle fa-lg'></i></button>    ");
            }
            return renderFiltered(event);
        },
        // DOM-Event handling for Calendar Eventblocks (why do js people suck at naming)
        eventOverlap: function(stillEvent, movingEvent) {
            if (stillEvent.color === movingEvent.color) {
                makeToast("warning", "Events of same color may not overlap");
            }
            return stillEvent.color !== movingEvent.color;
        },
        eventDrop: function(ev, delta, revertFunc, jsEvent, ui, view) {
            let startDate = moment(ev.start);
            startDate.subtract(delta);
            //  CHeck if sunday empty if day != sunday, may need to replace the template event
            if (startDate.day() === 0 && ev.start.day() !== 0) { // start of event NOW minus the amount it was moved, is on sunday AND the drop day is not sunday ---- therefore sunday needs copy of event
                // Adjust end date/time of event  since we're actually changing things
                let endDate = moment(ev.end);
                endDate.subtract(delta);

                $('#calendar').fullCalendar('renderEvent', {
                    title: event.title,
                    start: startDate,
                    end: endDate,
                    capacity: event.capacity,
                    modifier: event.modifier,
                    note: event.note,
                    room: event.room,
                    color: event.color,
                }); // add copy of event (but on sunday again) to event array
            } else if (ev.start.day() === 0 && startDate.day() != 0) {
                revertFunc();
                return false;
            }
        },
        hiddenDays: [6],
        businessHours: {
            // days of week. an array of zero-based day of week integers (0=Sunday)
            dow: [0, 1, 2, 3, 4, 5], // Monday - Thursday
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
    loadChangeTemplateEvent();
});

// Change event in template position to reflect the form data
function updateTemplateEvent() {

}

/* Needs to have all possible fields (so does add event on normal page though too I suppose --> e.g. maxBookings)
 * -- For this mode needs additional interval selection --- see blocks.go : IntervalData:
 *      WEEKLY/MONTHLY ==> 0/1 ; Delta ; Minot(Sub) Delta
 * ---  All events need this interval info
 *
 *
 *  Sync to the event held in the sunday position (maybe give it ID = -1 or something for easy lookup?
 *   -- onchange hhandler w/e
 */
function loadChangeTemplateEvent() {
    let xhttp = new XMLHttpRequest();
    xhttp.addEventListener("loadend", () => {
        if (xhttp.response > 300) {
            alert("ERROR: Could not load class list");
        }
        let classes = JSON.parse(xhttp.response);
        let tmpl = document.querySelector("#tmpl_EventForm").innerHTML;
        let func = doT.template(tmpl);
        document.querySelector("#eventForm").innerHTML = func(classes);
        document.querySelector("#submit").addEventListener("click", updateTemplateEvent);
    });
    xhttp.open("GET", "/api/v1/admin/classes")
    xhttp.send();
}

function submitTemplateForApplication() {

    let events = JSON.stringify(
        $("#calendar").fullCalendar(
            'clientEvents',
            (ev => { return ev.day() != 0; })
        )
    );

    // Get all events on calendar that aren't on sunday (template day) --> stringify for transmission to server
    let sendData =  {
        periodStart:    $("#periodStart"),
        periodEnd:      $("#periodEnd"),
        events:         events,
    };

    $.ajax({
        url: '/api/v1/schedule/build',
        type: 'POST',
        contentType:'json',
        data: events,
        dataType:'json',
        success: function(data) {
            makeToast("success", data.msg);
        },
        error: function(xhr, ajaxOptions, thrownError) {
            makeToast("error", "Request failed: " + xhr.responseText);
        }
    });
}
