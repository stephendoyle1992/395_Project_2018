package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"golang.org/x/crypto/bcrypt"
)

type roomFull struct {
	RoomID     int           `json:"roomId" db:"room_id"`
	RoomName   string        `json:"roomName" db:"room_name"`
	TeacherID  int           `json:"teacherId" db:"teacher_id"`
	Children   sql.NullInt64 `json:"children" db:"children"`
	RoomNumber string        `json:"roomNum" db:"room_num"`
}

type roomDetailed struct {
	RoomID     int           `json:"roomId" db:"room_id"`
	RoomName   string        `json:"roomName" db:"room_name"`
	Teacher    string        `json:"teacher" db:"teacher"`
	Children   sql.NullInt64 `json:"children" db:"children"`
	RoomNumber string        `json:"roomNum" db:"room_num"`
}

type roomShort struct {
	RoomID   int    `json:"roomId" db:"room_id"`
	RoomName string `json:"roomName" db:"room_name"`
}

type userFull struct {
	UserID    int    `json:"userId" db:"user_id"`
	UserRole  int    `json:"userRole" db:"user_role"`
	UserName  string `json:"userName" db:"username"`
	Password  []byte `json:"password" db:"password"`
	FirstName string `json:"firstName" db:"first_name"`
	LastName  string `json:"lastName" db:"last_name"`
	Email     string `json:"email" db:"email"`
	Phone     string `json:"phoneNumber" db:"phone_number"`
}

type userShort struct {
	UserID   int    `json:"userId" db:"user_id"`
	UserName string `json:"userName" db:"username"`
}

type familyFull struct {
	FamilyID   int           `json:"familyId" db:"family_id"`
	FamilyName string        `json:"familyName" db:"family_name"`
	ParentOne  int           `json:"parentOne" db:"parent_one"`
	ParentTwo  sql.NullInt64 `json:"parentTwo" db:"parent_two"`
	Children   int           `json:"children" db:"children"`
}

type familyDetailed struct {
	FamilyID   int            `json:"familyId" db:"family_id"`
	FamilyName string         `json:"familyName" db:"family_name"`
	ParentOne  sql.NullString `json:"parentOne" db:"parent_one"`
	ParentTwo  sql.NullString `json:"parentTwo" db:"parent_two"`
	Children   sql.NullInt64  `json:"children" db:"children"`
}

func createFamily(w http.ResponseWriter, r *http.Request) {
	family := familyFull{}
	decoder := json.NewDecoder(r.Body)
	decoder.Decode(&family)

	fmt.Printf("%v#\n", family)

	q := `INSERT INTO family (family_name, parent_one, parent_two, children)
			VALUES ($1, $2, $3, $4)`

	_, err := db.Exec(q, family.FamilyName, family.ParentOne, family.ParentTwo,
		family.Children)

	if err != nil {
		logger.Println(err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusCreated)
}

func updateFamily(w http.ResponseWriter, r *http.Request) {
	family := familyFull{}
	decoder := json.NewDecoder(r.Body)
	decoder.Decode(&family)

	q := `UPDATE family
			SET family_name = $2, parent_one = $3, parent_two = $4, children = $5
			WHERE family_id = $1`

	_, err := db.Exec(q, family.FamilyID, family.FamilyName, family.ParentOne, family.ParentTwo,
		family.Children)

	if err != nil {
		logger.Println(err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusCreated)
}

func basicRoomList(w http.ResponseWriter, r *http.Request) {
	rooms := []roomShort{}
	q := `SELECT room_id, room_name
			FROM room;`

	err := db.Select(&rooms, q)
	if err != nil {
		logger.Println(err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	encoder := json.NewEncoder(w)
	encoder.Encode(rooms)
}

//gets all users not currently linked to a family
func lonelyFacilitators(w http.ResponseWriter, r *http.Request) {
	users := []userShort{}
	q := `SELECT user_id, username 
			FROM users 
			WHERE user_role = 1 
			AND user_id NOT IN 
				(
				SELECT user_id 
					FROM users, family 
					WHERE users.user_id = family.parent_one 
					OR family.parent_two = users.user_id
				)`
	err := db.Select(&users, q)
	if err != nil {
		logger.Println(err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	encoder := json.NewEncoder(w)
	encoder.Encode(users)
}

func getTeachers(w http.ResponseWriter, r *http.Request) {
	users := []userShort{}
	q := `SELECT user_id, username
			FROM users
			WHERE user_role = 2`
	err := db.Select(&users, q)
	if err != nil {
		logger.Println(err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	encoder := json.NewEncoder(w)
	encoder.Encode(users)
}

//does not return admin in this list
func getUserList(w http.ResponseWriter, r *http.Request) {
	options := r.URL.Query()
	userID, err := strconv.Atoi(options.Get("u"))
	//indicates we didnt have the flag or bad value
	if err != nil {
		q := `SELECT user_id, user_role, last_name, first_name, username, email, phone_number
				FROM users
				WHERE user_role != 3`
		userList := []userFull{}
		err := db.Select(&userList, q)

		if err != nil {
			logger.Println(err)
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		encoder := json.NewEncoder(w)
		encoder.Encode(userList)
	} else {
		q := `SELECT user_id, user_role, last_name, first_name, username, email, phone_number
				FROM users
				WHERE user_id = ($1)`
		user := userFull{}
		err := db.QueryRowx(q, userID).StructScan(&user)

		if err != nil {
			logger.Println(err)
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		encoder := json.NewEncoder(w)
		encoder.Encode(user)
	}
}

func createUser(w http.ResponseWriter, r *http.Request) {
	newUser := userFull{}
	decoder := json.NewDecoder(r.Body)
	decoder.Decode(&newUser)
	fmt.Printf("%#v", newUser)

	newPass, err := bcrypt.GenerateFromPassword(newUser.Password, bcrypt.DefaultCost)
	if err != nil {
		logger.Println(err)
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	q := `INSERT INTO users (user_role, username, password, first_name, last_name, email, phone_number)
			VALUES ($1, $2, $3, $4, $5, $6, $7)`

	_, err = db.Exec(q, newUser.UserRole, newUser.UserName, newPass,
		newUser.FirstName, newUser.LastName, newUser.Email, newUser.Phone)
	if err != nil {
		logger.Println(err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusCreated)
}

func updateUser(w http.ResponseWriter, r *http.Request) {
	user := userFull{}
	decoder := json.NewDecoder(r.Body)
	decoder.Decode(&user)

	q := `UPDATE users 
			SET username = $2, first_name = $3, last_name = $4, email = $5, phone_number = $6
			WHERE user_id = $1`

	_, err := db.Exec(q, user.UserID, user.UserName, user.FirstName, user.LastName, user.Email, user.Phone)
	if err != nil {
		logger.Println(err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func getFamilyList(w http.ResponseWriter, r *http.Request) {
	q := `SELECT family_id, family_name, parent_one, parent_two, children
				FROM family`

	familyList := []familyFull{}
	err := db.Select(&familyList, q)

	if err != nil {
		logger.Println(err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	encoder := json.NewEncoder(w)
	encoder.Encode(familyList)
}

func detailedFamily(w http.ResponseWriter, r *http.Request) {
	// TODO
	/*
		q := `SELECT family.family_id, family.family_name, users.username AS parent_one,
		user.username AS parent_two, family.children
		FROM family`
	*/
}

func getClassInfo(w http.ResponseWriter, r *http.Request) {
	q := `SELECT room.room_id, room.room_name, users.username AS teacher, room.room_num
			FROM room, users
			WHERE room.teacher_id = users.user_id`
	classes := []roomDetailed{}

	err := db.Select(&classes, q)
	if err != nil {
		logger.Println(err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	encoder := json.NewEncoder(w)
	encoder.Encode(classes)
}

func createClass(w http.ResponseWriter, r *http.Request) {
	class := roomFull{}
	decoder := json.NewDecoder(r.Body)
	decoder.Decode(&class)

	q := `INSERT INTO room (room_name, teacher_id, room_num)
			VALUES ($1, $2, $3)`

	_, err := db.Exec(q, class.RoomName, class.TeacherID, class.RoomNumber)
	if err != nil {
		logger.Println(err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusCreated)
}

func updateClass(w http.ResponseWriter, r *http.Request) {
	class := roomFull{}
	decoder := json.NewDecoder(r.Body)
	decoder.Decode(&class)

	q := `UPDATE room
			SET room_name = $2, teacher_id = $3, room_num = $4
			WHERE room_id = $1`

	_, err := db.Exec(q, class.RoomName, class.TeacherID, class.RoomNumber)
	if err != nil {
		logger.Println(err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusCreated)
}

func loadAdminDash(w http.ResponseWriter, r *http.Request) {
	pg, err := loadPage("admindashboard", r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusForbidden)
		return
	}
	s := tmpls.Lookup("admindashboard.tmpl")
	pg.DotJS = true
	s.ExecuteTemplate(w, "admindashboard", pg)
}

func loadAdminUsers(w http.ResponseWriter, r *http.Request) {
	pg, err := loadPage("adminusers", r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusForbidden)
		return
	}
	s := tmpls.Lookup("adminusers.tmpl")
	pg.DotJS = true
	s.ExecuteTemplate(w, "adminusers", pg)
}

func loadAdminCalendar(w http.ResponseWriter, r *http.Request) {
	pg, err := loadPage("calendar", r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusForbidden)
		return
	}
	pg.Calendar = true
	s := tmpls.Lookup("admincalendar.tmpl")
	pg.Calendar = true
	pg.DotJS = true
	s.ExecuteTemplate(w, "admincalendar", pg)
}

func loadAdminReports(w http.ResponseWriter, r *http.Request) {
	pg, err := loadPage("adminreports", r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusForbidden)
		return
	}
	s := tmpls.Lookup("adminreports.tmpl")
	pg.DotJS = true
	pg.Chart = true
	s.ExecuteTemplate(w, "adminreports", pg)
}

func loadAdminClasses(w http.ResponseWriter, r *http.Request) {
	pg, err := loadPage("adminclasses", r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusForbidden)
		return
	}
	s := tmpls.Lookup("adminclasses.tmpl")
	pg.DotJS = true
	s.ExecuteTemplate(w, "adminclasses", pg)
}
