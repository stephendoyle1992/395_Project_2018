package main

import (
	"fmt"
	"net/http"
	"time"

	"database/sql"

	"encoding/json"

	"github.com/gorilla/mux"
	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
)

/* TimeBlock ...
 * Corresponds to a tuple in the time_block table.
 */
type TimeBlock struct {
	ID       int       `db:"block_id" json:"blockID"`
	Start    time.Time `db:"block_start" json:"start"`
	End      time.Time `db:"block_end" json:"end"`
	Room     int       `db:"room_id" json:"room"`
	Modifier int       `db:"modifier" json:"modifier"`
	Capacity int       `db:"capacity" json:"capacity"`
	Title    string    `db:"title" json:"title"`
	Note     string    `db:"note" json:"note"`
}

type MsgWording struct {
	Start time.Time `db:"block_start" json:"start"`
	End   time.Time `db:"block_end" json:"end"`
	Title string    `db:"title" json:"title"`
	Room  string    `db:"room_name" json:"roomname"`
}

func getTimeBlockByID(id int) (*TimeBlock, error) {
	tb := new(TimeBlock)
	q := `SELECT * FROM time_block WHERE time_block.block_id = $1`
	err := db.QueryRow(q, id).Scan(&tb.ID, &tb.Start, &tb.End, &tb.Room, &tb.Capacity, &tb.Modifier, &tb.Title, &tb.Note)
	return tb, err
}

/*
 * Returns the bookings associated with a given timeblock
 */
func (tb *TimeBlock) bookings() ([]bookingBlock, error) {
	q := `SELECT booking_id FROM booking WHERE booking.block_id = $1`
	var bids []int
	err := db.Select(&bids, q, tb.ID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, err // Dont log this but pass it up chain incase its important to know
		}
		logger.Println(err)
		return nil, err
	}
	// Initialize the booking structs using the ids and return them in a slice
	var bookings []bookingBlock
	for _, bid := range bids {
		b := new(bookingBlock)
		err = b.init(bid)
		if err != nil {
			logger.Println("bookingBlock creation failed: ", err)
			return nil, err
		}
		bookings = append(bookings, *b)
	}
	return bookings, nil
}

/*
 * Inserts tb into the database, returns the id (and actively sets the structs ID field in place)
 */
func (tb *TimeBlock) insert() (int, error) {

	q := `INSERT INTO time_block (block_start, block_end, room_id, modifier, capacity, title, note)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
			RETURNING block_id`
	err := db.QueryRow(q, tb.Start, tb.End, tb.Room, tb.Modifier, tb.Capacity, tb.Title, tb.Note).Scan(&tb.ID)
	if err != nil {
		return -1, err
	}
	return tb.ID, nil

}

func getOldTimeBlockValues(tx *sqlx.Tx, tid int) (MsgWording, error) {
	var msg MsgWording
	q := "select time_block.block_start, time_block.block_end, time_block.title, room.room_name from time_block, room where time_block.block_id = $1 AND room.room_id = time_block.room_id"
	stmt, err := tx.Preparex(q)
	if err != nil {
		logger.Println(err)
		return msg, err
	}
	defer stmt.Close()

	if err := stmt.Get(&msg, tid); err != nil {
		tx.Rollback()
		logger.Println(err)
		return msg, err
	}
	return msg, nil
}

func getUsersInTimeBlockValues(tx *sqlx.Tx, tid int) ([]int, error) {
	var usrs []int
	logger.Println(tid)
	q := "SELECT user_id FROM booking WHERE block_id = $1"
	stmt, err := tx.Preparex(q)
	if err != nil {
		logger.Println(err)
		return usrs, err
	}
	defer stmt.Close()

	if err := stmt.Select(&usrs, tid); err != nil {
		tx.Rollback()
		logger.Println(err)
		return usrs, err
	}
	logger.Println(usrs)
	return usrs, nil

}

func updateTimeBlockQuery(tx *sqlx.Tx, tb *TimeBlock) error {
	q := "UPDATE time_block SET(block_id, block_start, block_end, room_id, capacity, modifier, title, note) = ($1, $2, $3, $4, $5, $6, $7, $8) WHERE (time_block.block_id = $1)"
	stmt, err := tx.Preparex(q)
	if err != nil {
		logger.Println(err)
		return err
	}
	defer stmt.Close()

	if _, err := stmt.Exec(tb.ID, tb.Start, tb.End, tb.Room, tb.Capacity, tb.Modifier, tb.Title, tb.Note); err != nil {
		tx.Rollback()
		logger.Println(err)
		return err
	}
	return nil
}

func deleteTimeBlockQuery(tx *sqlx.Tx, tid int) error {
	q := "DELETE FROM time_block WHERE block_id = $1"
	stmt, err := tx.Preparex(q)
	if err != nil {
		logger.Println(err)
		return err
	}
	logger.Println("stmt")
	defer stmt.Close()
	logger.Println("stmt")
	if _, err := stmt.Exec(tid); err != nil {
		tx.Rollback()
		logger.Println(err)
		return err
	}
	logger.Println("stmt")
	return nil
}

func deleteExistingBookings(tx *sqlx.Tx, tid int) error {
	q := "DELETE from booking where block_id = $1"
	stmt, err := tx.Preparex(q)
	if err != nil {
		logger.Println(err)
		return err
	}
	logger.Println("stmt")
	defer stmt.Close()
	logger.Println("stmt")
	if _, err := stmt.Exec(tid); err != nil {
		tx.Rollback()
		logger.Println(err)
		return err
	}
	logger.Println("stmt")
	return nil
}

func createNewMessage(tx *sqlx.Tx, msg MsgWording, change string) (int, error) {
	var msgID int
	const layout = "Jan 2, 2006 at 3:04pm"

	q := "INSERT INTO notifications (msg) values ($1) RETURNING msg_id"
	newMsg := fmt.Sprintf("The event '%v' you were booked on %v-%v in room '%v' has been %v and you have been unbooked.", msg.Title, msg.Start.Format(layout), msg.End.Format(layout), msg.Room, change)
	stmt, err := tx.Preparex(q)
	if err != nil {
		logger.Println(err)
		return 0, err
	}
	defer stmt.Close()

	if err := stmt.Get(&msgID, newMsg); err != nil {
		tx.Rollback()
		logger.Println(err)
		return 0, err
	}
	return msgID, nil
}

func createMessageForUsers(tx *sqlx.Tx, u int, msgID int) error {
	q := "INSERT INTO notify (user_id, msg_id) values ($1, $2)"
	stmt, err := tx.Preparex(q)
	if err != nil {
		logger.Println(err)
		return err
	}
	defer stmt.Close()

	if _, err := stmt.Exec(u, msgID); err != nil {
		tx.Rollback()
		logger.Println(err)
		return err
	}
	return nil
}

/*
 * Saves the state of the block (tb)
 * to the db. Where tb is an existing block in the db
 */
func (tb *TimeBlock) update() error {
	return blockChanges(tb, true)
}

/*
 * Deletes the recieving block's (tb) entry in the db.
 */
func (tb *TimeBlock) delete() error {

	return blockChanges(tb, false)
}

func blockChanges(tb *TimeBlock, isUpdate bool) error {
	tx, err := db.Beginx()
	if err != nil {
		return err
	}
	var msg MsgWording
	var usrs []int
	var msgID int
	change := "updated"
	if !isUpdate {
		change = "removed"
	}
	{
		msg, err = getOldTimeBlockValues(tx, tb.ID)
		if err != nil {
			return err
		}
		logger.Println(msg)
	}
	{
		usrs, err = getUsersInTimeBlockValues(tx, tb.ID)
		if err != nil {
			return err
		}
	}
	const layout = "Jan 2, 2006 at 3:04pm"
	if isUpdate && msg.Start.Format(layout) != tb.Start.Format(layout) && msg.End.Format(layout) != tb.End.Format(layout) {
		err = deleteExistingBookings(tx, tb.ID)
		if err != nil {
			return err
		}
	}
	if isUpdate {
		{
			err = updateTimeBlockQuery(tx, tb)
			if err != nil {
				return err
			}
		}
	} else {
		{
			err = deleteTimeBlockQuery(tx, tb.ID)
			if err != nil {
				return err
			}
		}
	}
	if !isUpdate || (isUpdate && msg.Start.Format(layout) != tb.Start.Format(layout) && msg.End.Format(layout) != tb.End.Format(layout)) {
		{
			msgID, err = createNewMessage(tx, msg, change)
			if err != nil {
				return err
			}
		}
		for _, u := range usrs {
			{
				err = createMessageForUsers(tx, u, msgID)
				if err != nil {
					logger.Println(err)
					return err
				}
			}
		}
	}
	return tx.Commit()
}

/*
 * Retrieve records for block(s) from table in range (start inclusive, end exclusive).
 */
func getBlocks(start time.Time, end time.Time) ([]TimeBlock, error) {
	// Retrieve blocks w/in date range
	q := `SELECT * FROM time_block
			   WHERE block_start >= $1 AND block_end <= $2`
	var blocks []TimeBlock
	err := db.Select(&blocks, q, start, end)

	if err != nil {
		return nil, err
	} else if len(blocks) > 0 {
		return blocks, nil
	} else {
		return nil, nil
	}
}

func getBlocksWithMoments(start string, end string) ([]TimeBlock, error) {
	// Retrieve blocks w/in date range
	q := `SELECT * FROM time_block
			   WHERE block_start >= $1 AND block_end <= $2`
	var blocks []TimeBlock
	err := db.Select(&blocks, q, start, end)

	if err != nil {
		return nil, err
	} else if len(blocks) > 0 {
		return blocks, nil
	} else {
		return nil, nil
	}
}

/* Setter for day field of timeblock */
func (tb *TimeBlock) setDay(startDate time.Time) {
	tb.Start = time.Date(startDate.Year(), startDate.Month(), startDate.Day(), tb.Start.Hour(), tb.Start.Minute(), 0, 0, tb.Start.Location())
	tb.End = time.Date(startDate.Year(), startDate.Month(), startDate.Day(), tb.End.Hour(), tb.End.Minute(), 0, 0, tb.Start.Location())
}

/* For templating calendar aka schedule builder mode */
const (
	WEEKLY = iota
	MONTHLY
)

type IntervalData struct {
	Repeats int `json:"repeatType"`   // See constant declarations above
	Delta   int `json:"primaryDelta"` // e.g. 2 ==> every 2nd week/month, 1 == every week/month, 3 == every 3rd week/month
	// SubDelta may b eused for monthly repeaters
	secondaryDeltas []int `json:"secondaryDeltas"` // E.g. Every 2nd monday (on a 2nd month Delta) --> 2nd monday of every 2nd month;; is a slice to allow for things like (1, 3) --> 1st and 3rd Day of DeltaREpeatingMonth
}

/*
 * Events from templater have interval fields included
 */
type BuilderEvent struct {
	Event
	Interval IntervalData
}

// Advance by major delta (e.g. next month)
func (be BuilderEvent) Increment() BuilderEvent {
	logger.Println("++: ", be)
	switch be.Interval.Repeats {
	case WEEKLY:
		be.Start = be.Start.AddDate(0, 0, 7*be.Interval.Delta)
		be.End = be.End.AddDate(0, 0, 7*be.Interval.Delta)
	case MONTHLY:
		be.Start = be.Start.AddDate(0, be.Interval.Delta, 0)
		be.End = be.End.AddDate(0, be.Interval.Delta, 0)
	}
	return be
}

/*
 * List of builderEvents for creating schedule
 * Period start = inclusive start date for period to build
 * Period end is exclusive moment for period to build in
 */
type ScheduleBuilderData struct {
	Events      []BuilderEvent `json:"events"`
	PeriodStart time.Time      `json:"periodStart"`
	PeriodEnd   time.Time      `json:"periodEnd"`
}

// For handling template build/destroy/whateverelse POSTS
func schedulePostHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		return
	}
	role, err := getRoleNum(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if role != ADMIN {
		http.Error(w, "You must be an admin to do this action (your auth cookie may have expired)", http.StatusForbidden)
		return
	}

	dest := mux.Vars(r)["target"] // Determine POST destination from URL
	switch dest {
	case "build":
		buildRequestHandler(w, r)
		return
	case "destroy":
		// If theres time, maybe a takedown mode I dunno
		http.Error(w, "Not implemented yet", http.StatusBadGateway)
		return
	default:
		http.Error(w, "Invalid destination specified", http.StatusBadGateway)
	}
}

func buildRequestHandler(w http.ResponseWriter, r *http.Request) {
	dec := json.NewDecoder(r.Body)
	builderData := new(ScheduleBuilderData)
	err := dec.Decode(builderData)
	if err != nil {
		logger.Println(builderData)
		logger.Println(err)
		http.Error(w, "Could not complete request", http.StatusInternalServerError)
		return
	}
	logger.Println(builderData)

	// separate by room
	// only days are relevant coming from the builder (set the year/month to the start of the period
	// Subtract a month, to guarentee we don't miss anything in the window (because the calendar is using the current date, it could be like the 24th or something; moving back to last month compensates
	// our building algorithm will increment by week until period is hit
	bdRoomMap := make(map[string][]BuilderEvent)
	for _, e := range builderData.Events {
		e.Start = time.Date(builderData.PeriodStart.Year(), builderData.PeriodStart.Month()-1, e.Start.Day(), e.Start.Hour(), e.Start.Minute(), 0, 0, time.Local)
		e.End = time.Date(builderData.PeriodStart.Year(), builderData.PeriodStart.Month()-1, e.End.Day(), e.End.Hour(), e.End.Minute(), 0, 0, time.Local) // builder sets utcOffset to 0
		bdRoomMap[e.Room] = append(bdRoomMap[e.Room], e)                                                                                                  // Split up by rooms (can be parallelized)
	}

	/*
	 * Building schedule is complex; quadratic best case, most likely cubic or worse on average.
	 * We use go routines for each room, as their blocks are independent, so can be parallelized easily.
	 * Additionally, we know adding events to DB will have significant I/O time, so we can swap in other room's routines
	 * rather than wait for each write before proceeding. Going over board with the routines would be bad in otherways,
	 * gut feeling says rooms should be sufficient as a divisor.
	 */
	for _, evs := range bdRoomMap { // ignore roomnames [key is blanked (i.e. _)]
		BuildSchedule(evs, builderData.PeriodStart, builderData.PeriodEnd)
	}

	rr := &Response{Msg: "whew!"}
	rr.send(w)
	return
}

/* Creates blocks to satisfy the interval conditions  for each bd in evs, within the period indicated by sop/eop (startofendofperiod */
func BuildSchedule(evs []BuilderEvent, sop, eop time.Time) {
	for _, be := range evs { // foreach be => BuilderEvent given via template calendar
		// Before start of period (period starts  mid week for example), add weeks until in ranger
		for be.Start.Before(sop) {
			// dun dun dun duh duuuuuuuuun de da da dun de da dooo da da bump ba bum bah da (*james bond theme plays*)
			be.Start = be.Start.AddDate(0, 0, 7)
			be.End = be.End.AddDate(0, 0, 7)
		}

		for be.Start.Before(eop) { // event in range --> add it to calendar and increment
			logger.Println("ANY: ", be)

			if be.RoomID == 0 {
				q := `SELECT room_id FROM room WHERE room_name = $1`
				err := db.QueryRow(q, be.Room).Scan(&be.RoomID)
				if err != nil {
					logger.Println(err)
					continue
				}
			}

			switch be.Interval.Repeats {
			case MONTHLY:
				logger.Println("MONTHLY: ", be)
				for _, i := range be.Interval.secondaryDeltas { // For each sub delta value --> add events to calendar for the month
					subEv := be
					subEv.Start = subEv.Start.AddDate(0, 0, 7*i) // add subDelta to start/end
					subEv.End = subEv.End.AddDate(0, 0, 7*i)
					if subEv.Start.Before(eop) { // if still in range add, else continue (no guarentee list is sorted, must keep going!)
						_, err := subEv.add() // Add the event if still in range
						if err != nil {
							logger.Println(err)
						}
					}
				}
			case WEEKLY:
				logger.Println("WEEKLY: ", be)
				be.add() // Add to db
			}
			be = be.Increment() // increment by Delta
		}
	}
}
