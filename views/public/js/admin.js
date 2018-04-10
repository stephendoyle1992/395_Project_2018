document.addEventListener("DOMContentLoaded", function() {
    if (window.location.href.split("/").pop() == "dashboard") {
		loadDash();
		loadNewNotificationForm();
		loadOldNotifications();
    }
})

function inputCheck(input) {
	//referenced from https://stackoverflow.com/questions/23556533/how-do-i-make-an-input-field-accept-only-letters-in-javascript

	if (input.value == "" ) {
		makeToast('error', `${input.name} cannot be empty`)
		input.classList.add('alert');
		input.classList.add('alert-danger');
		return true
	}

	let chars = /^[a-zA-Z0-9_ ]*$/
	if (!chars.test(input.value)) {
		makeToast('error', `${input.name} can only contain letters, numbers, and spaces`)
		input.classList.add('alert');
		input.classList.add('alert-danger');
		return true;
	}
	input.classList.remove('alert');
	input.classList.remove('alert-danger');
	return false;
}

function roomCheck(input) {
	if (input.value == "" ) {
		makeToast('error', `${input.name} cannot be empty`)
		input.classList.add('alert');
		input.classList.add('alert-danger');
		return true
	}

	//regex pulled from: 
	//https://stackoverflow.com/questions/8292965/regular-expression-for-number-and-dash
	let chars = /^[0-9-]+$/
	if (!chars.test(input.value)) {
		makeToast('error', `${input.name} can only contain numbers and "-"`)
		input.classList.add('alert');
		input.classList.add('alert-danger');
		return true;
	}

	input.classList.remove('alert');
	input.classList.remove('alert-danger');
	return false

}

function phoneCheck(input) {
	if (input.value == "" ) {
		makeToast('error', `${input.name} cannot be empty`)
		input.classList.add('alert');
		input.classList.add('alert-danger');
		return true
	}

	//posible phone chars referenced from
	//https://stackoverflow.com/questions/4338267/validate-phone-number-with-javascript
	let chars = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/im

	if (!chars.test(input.value)) {
		makeToast('error', `${input.name} is not a valid phone number`)
		input.classList.add('alert');
		input.classList.add('alert-danger');
		return true;
	}
	input.classList.remove('alert');
	input.classList.remove('alert-danger');
	return false
}

function emailCheck(input) {

	if (input.value == "" ) {
		makeToast('error', `${input.name} cannot be empty`)
		input.classList.add('alert');
		input.classList.add('alert-danger');
		return true
	}	

	//posible email chars referenced from
	//https://stackoverflow.com/questions/46155/how-to-validate-an-email-address-in-javascript
	let chars = /^(([^<>()\[\]\.,;:\s@\"]+(\.[^<>()\[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\.,;:\s@\"]+\.)+[^<>()[\]\.,;:\s@\"]{2,})$/i

	if (!chars.test(input.value)) {
		makeToast('error', `${input.name} is not a valid email address`)
		input.classList.add('alert');
		input.classList.add('alert-danger');
		return true;
	}
	input.classList.remove('alert');
	input.classList.remove('alert-danger');
	return false
}


function passCheck(pw1, pw2) {

	if (pw1.value == "") {
		makeToast('error', `${pw1.name} cannot be empty`)
		pw1.classList.add('alert');
		pw1.classList.add('alert-danger');
		pw2.classList.add('alert');
		pw2.classList.add('alert-danger');
		return true;
	}

	if (pw1.value.length < 8) {
		makeToast('error','Password must be longer than 8 characters');
		pw1.classList.add('alert');
		pw1.classList.add('alert-danger');
		pw2.classList.add('alert');
		pw2.classList.add('alert-danger');
        return true;
	}

    if (pw1.value != pw2.value) {
		makeToast('error','Passwords do not match');
		pw2.classList.add('alert');
		pw2.classList.add('alert-danger');
		pw1.classList.add('alert');
		pw1.classList.add('alert-danger');
        return true;
	}

	pw1.classList.remove('alert');
	pw1.classList.remove('alert-danger');
	pw2.classList.remove('alert');
	pw2.classList.remove('alert-danger');
	return false;
}

//sets active category in top bars
function setActiveCategory() {
    let cat = window.location.href.split("/").pop();
    document.querySelector(`#${cat}Btn`).setAttribute('class','active');
}

function download(filename, text) {
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);
    
    element.style.display = 'none';
    document.body.appendChild(element);
    
    element.click();
    
    document.body.removeChild(element);
}

function monthSwitch(num) {
    switch(num) {
    case 1:
	return "January";
    case 2:
	return "February";
    case 3:
	return "March";
    case 4:
	return "April";
    case 5:
	return "May";
    case 6:
	return "June";	
    case 7:
	return "July";
    case 8:
	return "August";	
    case 9:
	return "September";	
    case 10:
	return "October";	
    case 11:
	return "November";
    case 12:
	return "December";
    }
}

function exportMonthly() {
    let xhttp = new XMLHttpRequest();
    xhttp.addEventListener("loadend", () => {
    	data = JSON.parse(xhttp.response);
    	let str = [[]];
    	let weeks = ["family"]
    	for (let i=0; i<data[0].weeks.length; i++) {
    	    weeks.push(`week ${i+1}`);
    	}
    	str.push(weeks);
    	for (let i=0; i<data.length; i++) {
    	    let row = []
    	    row.push(data[i].familyName);
    	    for (let j=0; j<data[i].weeks.length; j++) {
    		row.push(data[i].weeks[j].total);
    	    }
    	    str.push(row);
    	}
	m = $("#time")[0].valueAsDate.getMonth() + 1;
	var input = monthSwitch(m);
	var csvContent = `Hours: ${input}`;
    	str.forEach(function(rowArray){
    	    let str = rowArray.join(",");
    	    csvContent += str + "\r\n";
	});
		    
	download(`Hours: ${input}.csv`, csvContent);
    });
    
    xhttp.open("GET", `/api/v1/charts?date=${$("#time")[0].value}`);
    xhttp.send();
}



function exportPdf() {
    m = $("#time")[0].valueAsDate.getMonth() + 1;
    var input = monthSwitch(m);
    url = $("#skills")[0].toDataURL("image/png");

    var element = document.createElement('a');
    element.setAttribute('href',url);
    element.setAttribute('download', `${input} report.png`);
    
    element.style.display = 'none';
    document.body.appendChild(element);
    
    element.click();
    
    document.body.removeChild(element);
}

function next() {
    var test = moment($("#time")[0].value).add(1, 'months');
    $("#time")[0].value = moment(test).format("YYYY-MM-DD");
    familyData();
}

function previous() {
    var test = moment($("#time")[0].value).add(-1, 'months');
    $("#time")[0].value = moment(test).format("YYYY-MM-DD");
    familyData();
}

function familyData() {
    let xhttp = new XMLHttpRequest();
    xhttp.addEventListener("loadend", () => {
    	let httpData = JSON.parse(xhttp.response);
    	list = []
    	for (let i=0; i< httpData[0].weeks.length; i++) {
    	    list.push(httpData[0].weeks[i].start + " - " + httpData[0].weeks[i].end)
    	}
    	var ctx = document.getElementById('skills').getContext('2d');
    	var barData = {
    	    labels: list,
    	    datasets: []
    	};
	
    	window.myBar = new Chart(ctx, {
	    //    	    type: 'horizontalBar',
	    type: "line",
    	    data: barData,
    	    options: {
    		scales: {
//		        		    xAxes: [{
		    yAxes: [{
    			ticks : { 
    			    min: -5,
    			    max: 5,
    			    stepSize: 0.5
    			}
    		    }]
    		}
    	    }
    	});


    	var colourList = ["#00FFFF", "#A52A2A", "#7FFF00", "#FF7F50",
    			  "#006400", "#8B008B", "#FFD700", "#808080"]
    	var total = 0;
    	for (let i=0; i<httpData.length;i++) {
    	    let hours = [];
    	    let name = httpData[i].familyName;
    	    for (let j=0; j<httpData[i].weeks.length;j++) {
    		hours.push(httpData[i].weeks[j].total);
    	    }
    	    barData.datasets.push({
    		label: name,
		fill: false,
		borderColor: colourList[total%8],
    		backgroundColor: colourList[total%8],
    		borderWidth: 5,
    		data: hours
    	    });
    	    total++;
    	}
    	window.myBar.update();
    });
    xhttp.open("GET", `/api/v1/charts?date=${$("#time")[0].value}`);
    xhttp.send();
}

function loadOldNotifications(){
    let xhttp = new XMLHttpRequest();
    xhttp.addEventListener("loadend", () => {
		console.log(xhttp.response);
        let msgInfo = JSON.parse(xhttp.response);
        let tmpl = document.querySelector("#Notification_tmpl").innerHTML;
        let func = doT.template(tmpl);
		document.querySelector("#display_notifications").innerHTML = func(msgInfo);
    });
    xhttp.open("GET", `/api/v1/admin/notification`);

    xhttp.send();
}

function loadNewNotificationForm() {
	let tmpl = document.querySelector("#newNotification_tmpl").innerHTML;
	document.querySelector("#display_new_notification").innerHTML = tmpl;
	$('#parent-select').multiSelect({
		selectableHeader: "<div class='parent-select'>Available Facilitators</div>",
		selectionHeader: "<div class='parent-select'>Users to Notify</div>"
	});
	$('#parent-select').multiSelect({});
	
	$.getJSON("/api/v1/admin/allFacilitators", function(data, status){
		$.each(data, function(index){
			$('#parent-select').multiSelect('addOption', { value: data[index].userId, text: data[index].userName});
		});
	});
	document.querySelector("#submit").addEventListener('click', submitNewNotification);
}

function deleteMsg(msgid) {
    $.ajax({
        url: '/api/v1/admin/notification/' + msgid,
        type: 'DELETE',
        error: function(xhr, ajaxOptions, thrownError) {
            makeToast("error", "Request failed: " + xhr.responseText);
        }
    })
}
    
function loadDash() {
    let xhttp = new XMLHttpRequest();
    xhttp.addEventListener("loadend", () => {
        let familyInfo = JSON.parse(xhttp.response);
        let tmpl = document.querySelector("#tmpl_familyList").innerHTML;
        let func = doT.template(tmpl);
		document.querySelector("#displayData").innerHTML = func(familyInfo);
    });
    xhttp.open("GET", `/api/v1/admin/dashboard`);

    xhttp.send();
}

function userList() {
    let xhttp = new XMLHttpRequest();
    xhttp.addEventListener("loadend", () => {
        let userInfo = JSON.parse(xhttp.response);
        let tmpl = document.querySelector("#tmpl_listUsers").innerHTML;
        let func = doT.template(tmpl);
		document.querySelector("#displayData").innerHTML = func(userInfo);
		
		$(document).ready(function(){
        	let userBtns = document.querySelectorAll("[id*='edit_']");
        	for (let i = 0; i < userBtns.length; i++) {
            	userBtns[i].addEventListener('click', loadEditUser);
        	}
        	let passBtns = document.querySelectorAll("[id*='pass_']");
        	for (let i = 0; i < passBtns.length; i++) {
            	passBtns[i].addEventListener('click', loadEditPassword);
			}
		});
    });
    xhttp.open("GET", `/api/v1/admin/users`);
    xhttp.send();
}

function loadEditUser(e) {
	let userID = e.target.id.split("_")[1];
	

	$.ajax({
		type: "GET",
		url: `/api/v1/admin/users/${userID}`,
		contentType: 'json',
	})
	.done(function(data) {
		let tmpl = document.querySelector("#tmpl_editUser").innerHTML;
		let func = doT.template(tmpl);

		document.querySelector("#displayData").innerHTML = 
			func(JSON.parse(data));
		document.querySelector("#cancel").addEventListener('click',
			userList);
		document.querySelector("#submit").addEventListener('click', 
			submitUserEdit);
		document.querySelector("#delete").addEventListener('click',
			deleteUser);
	})
	.fail(function(data) {
		makeToast('error', 'Could not load user info')
	});
}


function deleteWarning(e) {
	let username = document.querySelector("#uName").value;

	let check = prompt(`WARNING!\n\nARE YOU SURE YOU WANT TO DELETE USER: ${username}?\n\nTHIS WILL DELETE ALL RECORDS ASSOSCIATED WITH THIS USER, INCLUDING DONATIONS AND ANY PREVIOUS BOOKING RECORDS\n\nTo delete please type the username below.`, "")
	
	return (check === username)

}

function deleteUser(e) {
	
	let userID = document.querySelector("#IDNum").value;
	let username = document.querySelector("#uName").value;
	if (!deleteWarning()) { 
		makeToast("error", "Names did not match");
		return;
	}
	$.ajax({
		type: 'DELETE',
		url: `/api/v1/admin/users/${userID}`,
		dataType: 'text',
		contentType: 'text',
		success: function(data) {
			makeToast("success","User succesfully deleted.");
			userList();
		},
		error: function(data) {
			makeToast("error", "Internal server error, could not delete user.")
		}
	});
}



function familyList() {
    let xhttp = new XMLHttpRequest();
    xhttp.addEventListener("loadend", () => {
        let userInfo = JSON.parse(xhttp.response);
        let tmpl = document.querySelector("#tmpl_listFamilies").innerHTML;
        let func = doT.template(tmpl);
		document.querySelector("#displayData").innerHTML = func(userInfo);
		$(document).ready(function() {
        	let btns = document.querySelectorAll("[id*='edit_']");
        	for(let i = 0; i < btns.length; i++) {
            	btns[i].addEventListener("click", loadEditFamily);
			}
		});
    });
    xhttp.open("GET", `/api/v1/admin/families`);
    xhttp.send();
}

function loadEditFamily(e) {
    let familyID = e.target.id.split("_")[1];
    
    
    $.getJSON(`/api/v1/admin/families/${familyID}`, function(data, status){
        let tmpl = document.querySelector("#tmpl_editFamily").innerHTML;
        let func = doT.template(tmpl);

        document.querySelector("#displayData").innerHTML = func(data);
        document.querySelector("#cancel").addEventListener('click', familyList);
		document.querySelector("#submit").addEventListener('click', submitEditFamily);
		document.querySelector("#delete").addEventListener('click',
		deleteFamily);

        $('#parent-select').multiSelect({
            selectableHeader: "<div class='parent-select'>Available Facilitators</div>",
            selectionHeader: "<div class='parent-select'>Family Members</div>"
        });
        $('#parent-select').multiSelect({});
        $.each(data.parents, function(index){
            $('#parent-select').multiSelect('addOption', { value: data.parents[index].userId, text: data.parents[index].userName});
            $('#parent-select').multiSelect('select_all');
        });
        $.getJSON("/api/v1/admin/facilitators", function(data, status){
            $.each(data, function(index){
            $('#parent-select').multiSelect('addOption', { value: data[index].userId, text: data[index].userName});
            });
        });
    });
}

function deleteFamilyWarning(e) {
	let surname = document.querySelector("#famName").value;

	let check = prompt(`WARNING!\n\nARE YOU SURE YOU WANT TO DELETE FAMILY: ${surname}?\n\nTHIS WILL DELETE ALL RECORDS ASSOSCIATED WITH THIS FAMILY, INCLUDING ANY PREVIOUS BOOKING RECORDS\n\nTo delete please type the family name below.`, "");
	
	return (check === surname);

}

function deleteFamily(e) {
	let famID = document.querySelector("#famId").value;
	let surname = document.querySelector("#famName").value;
	if (!deleteFamilyWarning()) { 
		makeToast("error", "Names did not match");
		return;
	}
	$.ajax({
		type: 'DELETE',
		url: `/api/v1/admin/families/${famID}`,
		dataType: 'text',
		contentType: 'text',
		success: function(data) {
			makeToast("success","Family succesfully deleted.");
			familyList();
		},
		error: function(data) {
			makeToast("error", data.responseText)
		}
	});
}

//Not a big fan of the way this "removes" family members
//Could be more effecicient
function submitEditFamily() {
    let familyID = parseInt($("#famId").val());
	let surname = document.querySelector("#famName");
    let numChild = parseInt($("#children").val());
    let dList = new Array();
    let pList = new Array();
    $('#parent-select option:selected').each(function() {
        pList.push(parseInt($(this).val()));
    });
    $('#parent-select option:not(:selected)').each(function() {
        dList.push(parseInt($(this).val()));
	});
	
	if (inputCheck(surname)) {
		return;
	}

    let data = {"familyId":familyID, "familyName":surname.value,
                "children": numChild, "parents":pList, "dropped":dList};
    $.ajax({
        type: 'PUT',
        url: '/api/v1/admin/families',
        contentType: 'json',
        data: JSON.stringify(data),
        dataType: 'text',
        success: function(data) { 
            makeToast('success', 'Family updated');
            familyList();
        },
        error: function(xhr) {
            makeToast(`error`,`Could not update family: (${xhr.status})`);
        }
    });
}

function newFamily() {
    let tmpl = document.querySelector("#tmpl_newFamily").innerHTML;
    document.querySelector("#displayData").innerHTML = tmpl;
    $('#parent-select').multiSelect({
        selectableHeader: "<div class='parent-select'>Available Facilitators</div>",
        selectionHeader: "<div class='parent-select'>Family Members</div>"
    });
    $('#parent-select').multiSelect({});
    

    $.getJSON("/api/v1/admin/facilitators", function(data, status){
        $.each(data, function(index){
            $('#parent-select').multiSelect('addOption', { value: data[index].userId, text: data[index].userName});
        });
    });
    document.querySelector("#cancel").addEventListener('click', familyList);
    document.querySelector("#submit").addEventListener('click', submitNewFamily);
}

function lonelyFacilitators() {
    let xhttp = new XMLHttpRequest();
    xhttp.addEventListener("loadend", () => {
        let parents = JSON.parse(xhttp.response);
        let tmpl = document.querySelector("#tmpl_newParent").innerHTML;
        func = doT.template(tmpl);
        document.querySelector("#parents").insertAdjacentHTML('beforeend', func(parents));
    });
    xhttp.open("GET", "/api/v1/admin/facilitators");
    xhttp.send();
}

function submitNewNotification() {
    let pList = new Array();
    $('#parent-select option:selected').each(function() {
        pList.push(parseInt($(this).val()));
	});

	let newmsg= document.querySelector("#new_message_box").value;

	let data = {"parents":pList, "newmessage":newmsg};
	console.log("*********")
	console.log(data)
	console.log("*********")

    $.ajax({
        type: 'POST',
        url: '/api/v1/admin/notification',
        contentType: 'json',
        data: JSON.stringify(data),
        dataType: 'text',
        success: function(data) { 
			makeToast('success', 'Notification created');
			pList = new Array();
			newmsg= new String();
			loadNewNotificationForm();
			loadOldNotifications();
        },
        error: function(xhr) {
            makeToast('error', `Could not create Notification: (${xhr.status})`);
        }
    });
}

function submitNewFamily() {
	let surname = document.querySelector("#famName");
	let numChild = parseInt($("#children").val());
    let pList = new Array();
    $('#parent-select option:selected').each(function() {
        pList.push(parseInt($(this).val()));
	});
	
	if (inputCheck(surname)) {
		return;
	}

    let data = {"familyName":surname.value, "children": numChild, "parents":pList};

    $.ajax({
        type: 'POST',
        url: '/api/v1/admin/families',
        contentType: 'json',
        data: JSON.stringify(data),
        dataType: 'text',
        success: function(data) { 
            makeToast('success', 'Family created');
            familyList();
        },
        error: function(xhr) {
            makeToast('error', `Could not create family: (${xhr.status})`);
        }
    });
}

function submitUserEdit() {
        let uId = parseInt(document.querySelector("#IDNum").value);
        let newFName = document.querySelector("#fname");
        let newLName = document.querySelector("#lName");
        let newEmail = document.querySelector("#email");
        let newPhone = document.querySelector("#phoneNum"); 
		let newUName = `${newLName.value.toLowerCase()}_${newFName.value.toLowerCase()}`;
		let bNote  = document.querySelector("#bonusNote")
		let bHours = parseInt(document.querySelector("#bonusHours").value);

		if (bNote.value == null) {
			bNote.value = "None";
		}
		
		if (inputCheck(newFName) || inputCheck(newLName)
		|| emailCheck(newEmail) || phoneCheck(newPhone)) {
			return
		} 

        let xhttp = new XMLHttpRequest();
        xhttp.addEventListener("loadend", () => {
            if (xhttp.status > 300) {
				makeToast('error',`Could not update user: ${xhttp.responseText}`);
				return;
			}
            if (xhttp.status == 200) {
                makeToast('success','User updated.');
                userList();
            }
        });
		xhttp.open("PUT", "/api/v1/admin/users");
		console.log(JSON.stringify({userid:uId, username:newUName,
			firstname: newFName.value, lastname:newLName.value,
			email:newEmail.value, phoneNumber:newPhone.value,
			bonusHours: bHours, bonusNote: bNote.value}));
        xhttp.send(JSON.stringify({userid:uId, username:newUName,
                    firstname: newFName.value, lastname:newLName.value,
					email:newEmail.value, phoneNumber:newPhone.value,
					bonusHours: bHours, bonusNote: bNote.value}));
}

function newUser() {
    let tmpl = document.querySelector("#tmpl_addUser").innerHTML;
	document.querySelector("#displayData").innerHTML = tmpl;
    document.querySelector("#cancel").addEventListener('click', userList);
    document.querySelector("#submit").addEventListener('click', () => {

        

    let newRole = parseInt(document.querySelector("#role").value);
    let newFName = document.querySelector("#fname");
    let newLName = document.querySelector("#lName");
    let newEmail = document.querySelector("#email");
    let newPhone = document.querySelector("#phoneNum");
    let newUName = `${newLName.value}_${newFName.value}`.toLowerCase();
	let newPass = document.querySelector("#pass1");
	let passConfirm = document.querySelector("#pass2");
    let bHours = parseInt(document.querySelector("#bonusHours").value);
	let bNote = document.querySelector("#bonusNote");
		
	if (inputCheck(newFName) || inputCheck(newLName)
		|| emailCheck(newEmail) || phoneCheck(newPhone)
		|| passCheck(newPass, passConfirm)) {
		return;
	}

	if (bNote.value == null) {
		bNote.value = "None";
	}

    let newPassData = [];
    for (let i = 0; i < newPass.value.length; i++) {
        newPassData.push(newPass.value.charCodeAt(i));
    }

    let xhttp = new XMLHttpRequest();
    xhttp.addEventListener("loadend", () => {
        if (xhttp.status > 300) {
            makeToast('error',`Could not create user: ${xhttp.response}`);
            return;
        }
        if (xhttp.status == 201) {
            makeToast('success','User added to system');
            userList();
        }
        });
        xhttp.open("POST", "/api/v1/admin/users");
        xhttp.send(JSON.stringify({userrole:newRole, username:newUName,
                    password:newPassData, firstname: newFName.value, lastname:newLName.value,
                    email:newEmail.value, phoneNumber:newPhone.value, bonusHours:bHours, bonusNote:bNote.value}));
	});
}

function listClasses() {
    let xhttp = new XMLHttpRequest();
    xhttp.addEventListener("loadend", () => {
		let classes = JSON.parse(xhttp.response);
        let tmpl = document.querySelector("#tmpl_listClasses").innerHTML;
        let func = doT.template(tmpl);
		document.querySelector("#displayData").innerHTML = func(classes);
		
        $(document).ready(function() {
        	let btns = document.querySelectorAll("[id*='edit_']");
        	for(let i = 0; i < btns.length; i++) {
            	btns[i].addEventListener("click", loadEditClass);
			}
		});
     });
    xhttp.open("GET", "/api/v1/admin/classes");
    xhttp.send();
}


function loadEditClass(e) {
	let classID = e.target.id.split("_")[1];
    $.ajax({
        type: 'GET',
        url: `/api/v1/admin/classes/${classID}`,
        contentType: 'json',
        dataType: 'json',
        success: function(data) {
            let tmpl = document.querySelector("#tmpl_editClass").innerHTML;
            let func = doT.template(tmpl);
            //requires data[0] because API is returning a list
            document.querySelector("#displayData").innerHTML = func(data[0]);

            getTeachers();
			$(document).ready(function(){
            	document.querySelector("#cancel").addEventListener('click', listClasses);
				document.querySelector("#submit").addEventListener('click', submitClassEdit);
				document.querySelector("#delete").addEventListener('click',
				deleteClass)
			});
        },
        error: function(xhr) {
            makeToast('error',`Internal Server Error: Could not retrieve class info`);
            listClasses();
        },
    });
}

function submitClassEdit() {
    let classID = parseInt($("#cId").val());
	let className = document.querySelector("#cName");
	let classNum = document.querySelector("#cNum");
	let classTeacher = parseInt($("#cTeacher").val());
	
	if (inputCheck(className) || roomCheck(classNum)) {
		return;
	}

    let data = {"roomId":classID, "roomName": className.value, "teacherId": classTeacher,"roomNum":classNum.value};
    $.ajax({
        type: 'PUT',
        url: '/api/v1/admin/classes',
        contentType: 'json',
        data: JSON.stringify(data),
        dataType: 'text',
        success: function(data) { 
            makeToast("success", "Class updated");
            listClasses();
        },
        error: function(xhr) {
            makeToast(`error`,`Could not update class (${xhr.status})`);
        }
    });
}

function deleteClassWarning(e) {
	let classname = document.querySelector("#cName").value;

	let check = prompt(`WARNING!\n\nARE YOU SURE YOU WANT TO DELETE CLASS: ${classname}?\n\nTHIS WILL DELETE ALL TIME BLOCKS FOR THIS CLASS AND ANY PREVIOUS BOOKING RECORDS INVOLVED WITH THE ROOM.\n\nTo delete please type the class name below.`, "");
	
	return (check === classname);
}

function deleteClass() {
	let classID = parseInt($("#cId").val());

	if (!deleteClassWarning()) {
		return;
	}

	$.ajax({
		type: 'DELETE',
		url: `/api/v1/admin/classes/${classID}`,
		contentType: 'text',
	}).done(function(data){
		makeToast("success","Class deleted");
		listClasses();
	}).fail(function(data){
		makeToast("error", `Could not delete class: ${data.responseText}`)
	})
}

function getTeachers() {
    $.ajax({
        type: 'GET',
        url: '/api/v1/admin/teachers',
        contentType: 'json',
        dataType: 'json',
        success: function(data) { 
            let tmpl = document.querySelector("#tmpl_teachers").innerHTML;
            let func = doT.template(tmpl);
            document.querySelector("#cTeacher").insertAdjacentHTML('beforeend',func(data));
        },
        error: function(xhr) {
			makeToast('error','Internal Server Error: could not retrieve teacher data.');
            classList();
        },
    });
}


function addClassRoom() {
    let xhttp = new XMLHttpRequest();
    xhttp.addEventListener("loadend", () => {
        let facilitators = JSON.parse(xhttp.response);
        let tmpl = document.querySelector("#tmpl_createClass").innerHTML;
        let func = doT.template(tmpl);
		document.querySelector("#displayData").innerHTML = func(facilitators);
		$(document).ready(function() {
        	document.querySelector("#cancel").addEventListener('click', listClasses);
			document.querySelector("#submit").addEventListener('click', submitNewClass);
		});
    });
    xhttp.open("GET", `/api/v1/admin/teachers`);
    xhttp.send();
}

function submitNewClass() {
    let newName = document.querySelector("#cName");
    let newTeacher = parseInt(document.querySelector("#cTeacher").value);
    let newRoomNum = document.querySelector("#cNum");

	if ((inputCheck(newName) || roomCheck(newRoomNum))) {
		return;
	}
	
    let newClass = {"roomNAme":newName.value, "teacherId":newTeacher, "roomNum":newRoomNum.value};
    console.log(newClass);
    let xhttp = new XMLHttpRequest();
    xhttp.addEventListener("loadend", () => {
        if(xhttp.status > 300) {
            makeToast('error', `Could not create class - ${xhttp.responseText}`);
            return;
        }
		makeToast('success','Class created.');
        listClasses();
    });
    xhttp.open("POST", "/api/v1/admin/classes");
    xhttp.send(JSON.stringify(newClass));
}



function submitPassword() {
	let id = parseInt(document.querySelector("#uId").innerHTML);
	let pass1 = document.querySelector("#new_pwd");
	let pass2 = document.querySelector("#confirm_pwd");

	if (passCheck(pass1, pass2)) {
		return;
	}

	let newPassData = [];
    for (let i = 0; i < pass1.value.length; i++) {
        newPassData.push(pass1.value.charCodeAt(i));
    }

    $.ajax({
		type:'PUT',
		url: `/api/v1/admin/users/${id}`,
		data: JSON.stringify({"userId":id, "password": newPassData}),
		dataType: 'text',
		contentType: 'json',
	})
	.done(function(data){
		makeToast('success', 'Password updated');
		userList();
	})
	.fail(function(data){
		console.log(data);
		makeToast('error', `${data.responseText}`);
	})
}

function loadEditPassword(e) {
    let userID = e.target.id.split("_")[1];
    let xhttp = new XMLHttpRequest();
    xhttp.addEventListener("loadend", () => {
        let userInfo = JSON.parse(xhttp.response);
        let tmpl = document.querySelector("#tmpl_password").innerHTML;
        let func = doT.template(tmpl);
        document.querySelector("#displayData").innerHTML = func(userInfo);
        document.querySelector("#cancel").addEventListener('click', userList);
        document.querySelector("#submit").addEventListener('click', submitPassword);
    });
    xhttp.open("GET", `/api/v1/admin/users/${userID}`);
    xhttp.send();
}
