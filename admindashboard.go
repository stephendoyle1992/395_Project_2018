package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
	"github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

type roomFull struct {
	RoomID     int    `json:"roomId" db:"room_id"`
	RoomName   string `json:"roomName" db:"room_name"`
	TeacherID  int    `json:"teacherId" db:"teacher_id"`
	Children   int    `json:"children" db:"children"`
	RoomNumber string `json:"roomNum" db:"room_num"`
}

type roomDetailed struct {
	RoomID     int            `json:"roomId" db:"room_id"`
	RoomName   string         `json:"roomName" db:"room_name"`
	Teacher    sql.NullString `json:"teacher" db:"teacher"`
	TeacherID  sql.NullInt64  `json:"teacherId" db:"teacher_id"`
	Children   int            `json:"children" db:"children"`
	RoomNumber string         `json:"roomNum" db:"room_num"`
}

type roomShort struct {
	RoomID   int    `json:"roomId" db:"room_id"`
	RoomName string `json:"roomName" db:"room_name"`
}

type userFull struct {
	UserID     int    `json:"userId" db:"user_id"`
	UserRole   int    `json:"userRole" db:"user_role"`
	UserName   string `json:"userName" db:"username"`
	Password   []byte `json:"password" db:"password"`
	FirstName  string `json:"firstName" db:"first_name"`
	LastName   string `json:"lastName" db:"last_name"`
	Email      string `json:"email" db:"email"`
	Phone      string `json:"phoneNumber" db:"phone_number"`
	BonusHours int    `json:"bonusHours" db:"bonus_hours"`
	BonusNote  string `json:"bonusNote" db:"bonus_note"`
}

type UserShort struct {
	UserID   int    `db:"user_id" json:"userId"`
	UserName string `db:"username" json:"userName"`
}

/*
 * Retrieves the user's first + last name and returns it
 */
func (u *UserShort) getFullName() (name string, err error) {
	q := `SELECT first_name || ' ' || last_name FROM users WHERE user_id = $1`
	if u.UserID > 0 {
		err = db.QueryRow(q, u.UserID).Scan(&name)
	} else if u.UserName != "" {
		err = db.QueryRow(q, u.UserName).Scan(&name)
	} else {
		// struct is empty
		return "", errors.New("Cannot retrieve name of unidentifiable user -- need UID or UName")
	}

	return // returns name, error via magical named return values
}

type newMessage struct {
	Parents    []int  `json:"parents"`
	MessageID  int    `db:"msg_id"`
	NewMessage string `json:"newmessage" db:"msg"`
}

type AdminMessages struct {
	MessageID int    `json:"msgID" db:"msg_id"`
	Message   string `json:"message" db:"msg"`
	Read      int    `json:"read" db:"read"`
	Total     int    `json:"total" db:"total"`
}

func createAdminNotification(w http.ResponseWriter, r *http.Request) {
	var msg newMessage
	decoder := json.NewDecoder(r.Body)
	decoder.Decode(&msg)
	logger.Println(msg)
	tx, err := db.Begin()
	if err != nil {
		logger.Println(err)
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	q := `INSERT INTO notifications (msg, adminCreated)
			VALUES ($1, '1')
			RETURNING msg_id`

	q2 := `INSERT INTO notify (user_id, msg_id)
			VALUES ($1, $2)`

	err = tx.QueryRow(q, msg.NewMessage).Scan(&msg.MessageID)

	if err != nil {
		tx.Rollback()
		logger.Println(err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	for _, user := range msg.Parents {
		_, err := tx.Exec(q2, user, msg.MessageID)
		if err != nil {
			tx.Rollback()
			logger.Println(err)
			w.WriteHeader(http.StatusBadRequest)
			return
		}
	}
	tx.Commit()
	w.WriteHeader(http.StatusCreated)
}

func getAdminNotification(w http.ResponseWriter, r *http.Request) {
	q := `select distinct n.msg_id, n.msg, r.read, t.total 
			from notifications n, 
				(select msg_id, count(user_id) as total 
					from notify 
					group by msg_id) t, 
				(select msg_id, count(user_id) filter (where viewed = '1') as read 
					from notify 
					group by msg_id) r 
			where n.msg_id = r.msg_id AND n.msg_id = t.msg_id AND admincreated='1';`
	msgs := []AdminMessages{}
	err := db.Select(&msgs, q)
	if err != nil {
		logger.Println(err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	logger.Println(msgs)
	encoder := json.NewEncoder(w)
	encoder.Encode(msgs)
}

func deleteAdminNotification(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	msgID := vars["id"]
	tx, err := db.Begin()
	if err != nil {
		logger.Println(err)
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	q := `DELETE FROM notify WHERE msg_id = $1`

	q2 := `DELETE FROM notifications WHERE msg_id = $1`

	_, err = tx.Exec(q, msgID)

	if err != nil {
		tx.Rollback()
		logger.Println(err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	_, err = tx.Exec(q2, msgID)

	if err != nil {
		tx.Rollback()
		logger.Println(err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	tx.Commit()
	w.WriteHeader(http.StatusCreated)
}

type familyFull struct {
	FamilyID   int    `json:"familyId" db:"family_id"`
	FamilyName string `json:"familyName" db:"family_name"`
	Children   int    `json:"children" db:"children"`
	Parents    []int  `json:"parents"`
	Dropped    []int  `json:"dropped"`
}

type familyDetailed struct {
	FamilyID   int         `json:"familyId" db:"family_id"`
	FamilyName string      `json:"familyName" db:"family_name"`
	Children   int         `json:"children" db:"children"`
	Parents    []UserShort `json:"parents"`
}

func createFamily(w http.ResponseWriter, r *http.Request) {
	family := familyFull{}
	decoder := json.NewDecoder(r.Body)
	decoder.Decode(&family)
	tx, err := db.Begin()
	if err != nil {
		logger.Println(err)
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	q := `INSERT INTO family (family_name, children)
			VALUES ($1, $2)
			RETURNING family_id`

	q2 := `UPDATE users
			SET family_id = $2
			WHERE user_id = $1`

	err = tx.QueryRow(q, family.FamilyName,
		family.Children).Scan(&family.FamilyID)

	if err != nil {
		tx.Rollback()
		logger.Println(err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	for _, user := range family.Parents {
		_, err := tx.Exec(q2, user, family.FamilyID)
		if err != nil {
			tx.Rollback()
			logger.Println(err)
			w.WriteHeader(http.StatusBadRequest)
			return
		}
	}
	tx.Commit()
	w.WriteHeader(http.StatusCreated)
}

func updateFamily(w http.ResponseWriter, r *http.Request) {
	family := familyFull{}
	decoder := json.NewDecoder(r.Body)
	decoder.Decode(&family)
	tx, err := db.Begin()

	if err != nil {
		logger.Println(err)
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	q := `UPDATE family
			SET family_name = $2, children = $3
			WHERE family_id = $1`

	q2 := `UPDATE users
			SET family_id = $2
			WHERE user_id = $1`

	q3 := `UPDATE users
			SET family_id = NULL
			WHERE family_id = $2
			AND user_id = $1`

	_, err = tx.Exec(q, family.FamilyID, family.FamilyName,
		family.Children)

	if err != nil {
		tx.Rollback()
		logger.Println(err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	for _, user := range family.Parents {
		_, err := tx.Exec(q2, user, family.FamilyID)
		if err != nil {
			tx.Rollback()
			logger.Println(err)
			w.WriteHeader(http.StatusBadRequest)
			return
		}
	}

	for _, user := range family.Dropped {
		fmt.Println(user)
		_, err := tx.Exec(q3, user, family.FamilyID)
		if err != nil {
			tx.Rollback()
			logger.Println(err)
			w.WriteHeader(http.StatusBadRequest)
			return
		}
	}
	tx.Commit()
	w.WriteHeader(http.StatusOK)
}

func basicRoomList(w http.ResponseWriter, r *http.Request) {
	rooms := []roomShort{}
	q := `SELECT room_id, room_name
			FROM room ORDER BY UPPER(room_name)`

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
	users := []UserShort{}
	q := `SELECT user_id, username
			FROM users
			WHERE family_id IS NULL
			AND user_role = 1
			ORDER BY UPPER(username)`

	err := db.Select(&users, q)
	if err != nil {
		logger.Println(err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	encoder := json.NewEncoder(w)
	encoder.Encode(users)
}

//gets all users
func allFacilitators(w http.ResponseWriter, r *http.Request) {
	users := []UserShort{}
	q := `SELECT user_id, username
			FROM users
			where user_role = 1
			ORDER BY UPPER(username)`

	err := db.Select(&users, q)
	if err != nil {
		logger.Println(err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	logger.Println(users)
	encoder := json.NewEncoder(w)
	encoder.Encode(users)
}

func getTeachers(w http.ResponseWriter, r *http.Request) {
	users := []UserShort{}
	q := `SELECT user_id, username
			FROM users
			WHERE user_role = 2
			ORDER BY UPPER(username)`
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
	q := `SELECT user_id, user_role, last_name, first_name, username, email, phone_number
				FROM users
				WHERE user_role != 3
				ORDER BY UPPER(last_name)`
	userList := []userFull{}
	err := db.Select(&userList, q)

	if err != nil {
		logger.Println(err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	encoder := json.NewEncoder(w)
	encoder.Encode(userList)
}

func getSingleUser(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)

	idVal, err := strconv.Atoi(vars["user_id"])
	if err != nil {
		http.Error(w, "Bad UserID", http.StatusBadRequest)
		logger.Println(err)
		return
	}

	q := `SELECT user_id, user_role, last_name, first_name, username, email, phone_number, bonus_hours, bonus_note
				FROM users
				WHERE user_id = ($1)`
	user := userFull{}
	err = db.QueryRowx(q, idVal).StructScan(&user)

	if err != nil {
		logger.Println(err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	encoder := json.NewEncoder(w)
	encoder.Encode(user)
}

//this was taken from a CMPT315 Lab
//credit to Dr. Boers
func isUniqueViolation(err error) bool {
	if err, ok := err.(*pq.Error); ok {
		return err.Code == "23505"
	}

	return false
}

func createUser(w http.ResponseWriter, r *http.Request) {
	newUser := userFull{}
	decoder := json.NewDecoder(r.Body)
	decoder.Decode(&newUser)

	newPass, err := bcrypt.GenerateFromPassword(newUser.Password, bcrypt.DefaultCost)
	if err != nil {
		logger.Println(err)
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	q := `INSERT INTO users (user_role, username, password, first_name, last_name, email, phone_number, bonus_hours, bonus_note)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`

	_, err = db.Exec(q, newUser.UserRole, newUser.UserName, newPass,
		newUser.FirstName, newUser.LastName, newUser.Email, newUser.Phone,
		newUser.BonusHours, newUser.BonusNote)
	if err != nil {
		if isUniqueViolation(err) {
			logger.Println(err)
			http.Error(w, "User already exists", http.StatusBadRequest)
			return
		}
		logger.Println(err)
		errString := fmt.Sprintf("%s", err)
		http.Error(w, errString, http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusCreated)
}

func updateUser(w http.ResponseWriter, r *http.Request) {
	user := userFull{}
	decoder := json.NewDecoder(r.Body)
	decoder.Decode(&user)

	q := `UPDATE users 
			SET username = $2, first_name = $3, last_name = $4, email = $5, phone_number = $6, bonus_hours = $7, bonus_note = $8
			WHERE user_id = $1`

	_, err := db.Exec(q, user.UserID, user.UserName, user.FirstName, user.LastName, user.Email, user.Phone, user.BonusHours, user.BonusNote)
	if err != nil {
		logger.Println(err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func changePass(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)

	idVal, err := strconv.Atoi(vars["user_id"])
	if err != nil {
		http.Error(w, "Bad UserID", http.StatusBadRequest)
		logger.Println(err)
		return
	}
	newUser := userFull{}
	decoder := json.NewDecoder(r.Body)
	decoder.Decode(&newUser)

	adminPassUpdate(w, idVal, newUser.Password)
}

func removeFromFamily(w http.ResponseWriter, r *http.Request) {
	user := userFull{}
	decoder := json.NewDecoder(r.Body)
	decoder.Decode(&user)

	q := `UPDATE users
			SET family_id = NULL
			WHERE user_id = $1`

	_, err := db.Exec(q, user.UserID)
	if err != nil {
		logger.Println(err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func getFamilyList(w http.ResponseWriter, r *http.Request) {
	q := `SELECT family_id, family_name, children
				FROM family ORDER BY UPPER(family_name)`

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

func getSingleFamily(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)

	idVal, err := strconv.Atoi(vars["family_id"])
	if err != nil {
		http.Error(w, "Bad FamilyID", http.StatusBadRequest)
		logger.Println(err)
		return
	}
	q2 := `SELECT family_id, family_name, children
				FROM family
				WHERE family_id = $1`
	q3 := `SELECT user_id, username
				FROM users
				WHERE family_id = $1`
	family := familyDetailed{}
	err = db.QueryRowx(q2, idVal).StructScan(&family)

	if err != nil {
		logger.Println(err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	err = db.Select(&family.Parents, q3, idVal)
	if err != nil {
		logger.Println(err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	encoder := json.NewEncoder(w)
	encoder.Encode(family)
}

func getClassList(w http.ResponseWriter, r *http.Request) {
	q := `SELECT room.room_id, room.room_name, 
				users.username as teacher, room.room_num  
				FROM room 
				FULL OUTER JOIN users ON room.teacher_id = users.user_id WHERE room_id IS NOT NULL
				ORDER BY UPPER(room.room_name)`
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

func getSingleClass(w http.ResponseWriter, r *http.Request) {

	vars := mux.Vars(r)

	idVal, err := strconv.Atoi(vars["class_id"])
	if err != nil {
		http.Error(w, "Bad ClassID", http.StatusBadRequest)
		logger.Println(err)
		return
	}
	q2 := `SELECT room.room_id, room.room_name, 
				users.username as teacher, users.user_id AS teacher_id,room.room_num
				FROM room
				FULL OUTER JOIN users ON room.teacher_id = users.user_id WHERE room_id = $1`

	class := []roomDetailed{}

	err = db.Select(&class, q2, idVal)
	if err != nil {
		logger.Println(err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	encoder := json.NewEncoder(w)
	encoder.Encode(class)
}

func createClass(w http.ResponseWriter, r *http.Request) {
	class := roomFull{}
	decoder := json.NewDecoder(r.Body)
	decoder.Decode(&class)

	if class.TeacherID == -1 {
		q := `INSERT INTO room (room_name, room_num)
				VALUES ($1, $2)`
		_, err := db.Exec(q, class.RoomName, class.RoomNumber)
		if err != nil {
			logger.Println(err)
			w.WriteHeader(http.StatusBadRequest)
			return
		}
	} else {
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
}

func updateClass(w http.ResponseWriter, r *http.Request) {
	class := roomFull{}
	decoder := json.NewDecoder(r.Body)
	decoder.Decode(&class)

	if class.TeacherID == -1 {
		q := `UPDATE room
		SET room_name = $2, teacher_id = NULL, room_num = $3
		WHERE room_id = $1`
		_, err := db.Exec(q, class.RoomID, class.RoomName, class.RoomNumber)
		if err != nil {
			logger.Println(err)
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		w.WriteHeader(http.StatusCreated)
	} else {
		q := `UPDATE room
		SET room_name = $2, teacher_id = $3, room_num = $4
		WHERE room_id = $1`
		_, err := db.Exec(q, class.RoomID, class.RoomName, class.TeacherID, class.RoomNumber)
		if err != nil {
			logger.Println(err)
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		w.WriteHeader(http.StatusCreated)
	}
}

func deleteRoom(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)

	idVal, err := strconv.Atoi(vars["class_id"])
	if err != nil {
		http.Error(w, "Bad UserID", http.StatusBadRequest)
		logger.Println(err)
		return
	}

	q := `DELETE FROM room WHERE room_id = ($1)`

	_, err = db.Exec(q, idVal)
	if err != nil {
		http.Error(w, "Check server logs", http.StatusBadRequest)
		logger.Println(err)
		return
	}

	w.WriteHeader(http.StatusOK)

}

func deleteUser(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)

	idVal, err := strconv.Atoi(vars["user_id"])
	fmt.Println(idVal)
	if err != nil {
		http.Error(w, "Bad UserID", http.StatusBadRequest)
		logger.Println(err)
		return
	}

	tx, err := db.Begin()
	if err != nil {
		http.Error(w, "Error connecting to Database", http.StatusInternalServerError)
		logger.Println(err)
		return
	}

	q := `DELETE FROM donation WHERE donor_id = ($1)
			OR donee_id = ($1)`

	_, err = tx.Exec(q, idVal)
	if err != nil {
		http.Error(w, "Error deleting donation records", http.StatusInternalServerError)
		logger.Println(err)
		return
	}

	q = `DELETE FROM booking WHERE user_id = ($1)`

	_, err = tx.Exec(q, idVal)
	if err != nil {
		http.Error(w, "Error deleting user bookings", http.StatusInternalServerError)
		logger.Println(err)
		return
	}

	q = `DELETE FROM users WHERE user_id = ($1)`

	_, err = tx.Exec(q, idVal)
	if err != nil {
		http.Error(w, "Error deleting user", http.StatusInternalServerError)
		logger.Println(err)
		return
	}

	tx.Commit()

	w.WriteHeader(http.StatusOK)

}

func deleteFamily(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)

	idVal, err := strconv.Atoi(vars["family_id"])
	fmt.Println(idVal)
	if err != nil {
		http.Error(w, "Bad UserID", http.StatusBadRequest)
		logger.Println(err)
		return
	}

	tx, err := db.Begin()
	if err != nil {
		http.Error(w, "Error connecting to Database", http.StatusInternalServerError)
		logger.Println(err)
		return
	}

	q := `UPDATE users SET family_id = NULL WHERE family_id = ($1)`

	_, err = tx.Exec(q, idVal)
	if err != nil {
		http.Error(w, "Error removing parents", http.StatusInternalServerError)
		logger.Println(err)
		return
	}

	q = `DELETE FROM booking WHERE family_id = ($1)`

	_, err = tx.Exec(q, idVal)
	if err != nil {
		http.Error(w, "Error deleting bookings", http.StatusInternalServerError)
		logger.Println(err)
		return
	}

	q = `DELETE FROM family WHERE family_id = ($1)`

	_, err = tx.Exec(q, idVal)
	if err != nil {
		http.Error(w, "Error deleting family", http.StatusInternalServerError)
		logger.Println(err)
		return
	}
	tx.Commit()

	w.WriteHeader(http.StatusOK)
}

func loadAdminDash(w http.ResponseWriter, r *http.Request) {
	pg, err := loadPage("admindashboard", r)
	if err != nil {
		if _, ok := err.(*ClientSafeError); ok {
			http.Error(w, err.Error(), http.StatusBadGateway)
		} else {
			http.Error(w, "Something funny happened, sorry. Please try again ", http.StatusInternalServerError)
		}
		return
	}
	s := tmpls.Lookup("admindashboard.tmpl")
	pg.DotJS = true
	pg.Toaster = true
	pg.MultiSelect = true
	s.ExecuteTemplate(w, "admindashboard", pg)
}

func loadAdminUsers(w http.ResponseWriter, r *http.Request) {
	pg, err := loadPage("adminusers", r)
	if err != nil {
		if _, ok := err.(*ClientSafeError); ok {
			http.Error(w, err.Error(), http.StatusBadGateway)
		} else {
			http.Error(w, "Something funny happened, sorry. Please try again ", http.StatusInternalServerError)
		}
		return
	}
	s := tmpls.Lookup("adminusers.tmpl")
	pg.DotJS = true
	pg.MultiSelect = true
	pg.Toaster = true
	s.ExecuteTemplate(w, "adminusers", pg)
}

func loadAdminCalendar(w http.ResponseWriter, r *http.Request) {
	pg, err := loadPage("calendar", r)
	if err != nil {
		if _, ok := err.(*ClientSafeError); ok {
			http.Error(w, err.Error(), http.StatusBadGateway)
		} else {
			http.Error(w, "Something funny happened, sorry. Please try again ", http.StatusInternalServerError)
		}
		return
	}
	s := tmpls.Lookup("admincalendar.tmpl")
	pg.Calendar = true
	pg.DotJS = true
	pg.Toaster = true
	s.ExecuteTemplate(w, "admincalendar", pg)
}

func loadAdminReports(w http.ResponseWriter, r *http.Request) {
	pg, err := loadPage("adminreports", r)
	if err != nil {
		if _, ok := err.(*ClientSafeError); ok {
			http.Error(w, err.Error(), http.StatusBadGateway)
		} else {
			http.Error(w, "Something funny happened, sorry. Please try again ", http.StatusInternalServerError)
		}
		return
	}
	s := tmpls.Lookup("adminreports.tmpl")
	pg.DotJS = true
	pg.Chart = true
	pg.Toaster = true
	s.ExecuteTemplate(w, "adminreports", pg)
}

func loadAdminClasses(w http.ResponseWriter, r *http.Request) {
	pg, err := loadPage("adminclasses", r)
	if err != nil {
		if _, ok := err.(*ClientSafeError); ok {
			http.Error(w, err.Error(), http.StatusBadGateway)
		} else {
			http.Error(w, "Something funny happened, sorry. Please try again ", http.StatusInternalServerError)
		}
		return
	}
	s := tmpls.Lookup("adminclasses.tmpl")
	pg.DotJS = true
	pg.Toaster = true
	s.ExecuteTemplate(w, "adminclasses", pg)
}

func loadAdminScheduleBuilder(w http.ResponseWriter, r *http.Request) {
	pg, err := loadPage("builder", r)
	if err != nil {
		if _, ok := err.(*ClientSafeError); ok {
			http.Error(w, err.Error(), http.StatusBadGateway)
		} else {
			http.Error(w, "Something funny happened, sorry. Please try again ", http.StatusInternalServerError)
		}
		return
	}
	s := tmpls.Lookup("admincalendar.tmpl")
	// calendar dependency flag
	pg.Calendar = true
	pg.DotJS = true
	pg.Toaster = true
	s.ExecuteTemplate(w, "admincalendar", pg)
}
