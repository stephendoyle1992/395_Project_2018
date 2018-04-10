package main

import (
	"database/sql"
	"encoding/json"
	"io/ioutil"
	"net/http"
	"time"

	"github.com/lucasb-eyer/go-colorful"
)

type Donor interface {
	GiveCharity(donee *Family, amount float64) (*Donation, error)
	GetID() int
}

/* May be useful to have recipient interface which may differ? */
type Donee interface {
	GetID() int
}

/* For adjusting a family/facilitators hours per week, in the given period */
type DoneePeriod interface {
	GetDonee() Donee
	GetHours() float64
	SetHours(float64)
	GetStartDate() time.Time
	GetStartWeek() time.Time
	GetEndDate() time.Time
}

// Gets a dataset for the period
func GenerateCDS(dp DoneePeriod) (cds *ChartDataSet, err error) {
	cds = new(ChartDataSet).configureAsHistoricalHours("Donations", colorful.FastWarmColor().Hex(), false, 0.00)
	q := `SELECT amount, date_sent FROM donation
			WHERE donee_id = $1
				AND (
					(date_sent >= $2 AND date_sent <= $3)
					OR
					(date_sent >= $3 AND date_sent <= $2)
				)
			GROUP BY date_sent, amount`
	err = db.Select(&cds.Data, q, dp.GetDonee().GetID(), dp.GetStartDate(), dp.GetEndDate())
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return
}

type Donations []Donation
type ShortDonations []DonationShort


/* Get the total net amount for all of the donations in this slice */
func (gifts ShortDonations) netAmount(ID int) (netAmount float64) {
	for _, g := range gifts {
		if g.Recipient == ID {
			netAmount += g.Amount
		} else if g.Sender == ID {
			netAmount -= g.Amount
		}
	}
	return netAmount
}

/* Get the total net amount for all of the donations in this slice */
func (gifts Donations) netAmount(ID int) (netAmount float64) {
	for _, g := range gifts {
		if g.Recipient.GetID() == ID {
			netAmount += g.Amount
		} else if g.Sender.GetID() == ID {
			netAmount -= g.Amount
		}
	}
	return netAmount
}

/*
 * Donations for things that satisfy the interfaces
 */
type Donation struct {
	ID        int       `db:"donation_id" json:"id"`
	Sender    Donor     `json:"donor"`
	Recipient Donor     `json:"donee"`
	Amount    float64   `db:"amount" json:"amount"`
	Date      time.Time `db:"date_sent" json:"date"`
}

type DonationShort struct {
	ID        int       `db:"donation_id" json:"id"`
	Sender    int     	`db:"donor_id" json:"donor"`
	Recipient int     	`db:"donee_id" json:"donee"`
	Amount    float64   `db:"amount" json:"amount"`
	Date      time.Time `db:"date_sent" json:"date"`
}

/* FOR FAMILY DONORS ONLY AT THIS TIME -- IF USERS SATISFY THE INTERFACES NEED TO UPDATE THIS */
func (d *Donation) isLegal() (legal bool, err error) {
	if d.Sender.GetID() == d.Recipient.GetID() {
		return false, &ClientSafeError{Msg: "Cannot send donation to yourself!"};
	}
	family, err := GetFamilyByID(d.Sender.GetID())
	if err != nil {
		return false, err
	}
	fd := new(FamilyData)
	fd.init(family, time.Now())
	hrs, err := fd.GetAvailableHours()
	logger.Println(hrs, fd.HoursGoal)
	return d.Amount <= hrs, err
}

// save donation in db, update with returned id
func (d *Donation) save() error {
	q := `INSERT INTO donation (donor_id, donee_id, amount)
				VALUES ($1, $2, $3) RETURNING donation_id, date_sent`

	return db.QueryRow(q, d.Sender.GetID(), d.Recipient.GetID(), d.Amount).Scan(&d.ID, &d.Date)
}

type DonationData struct {
	Families   []Family `json:"families"`
	HoursAvail float64  `json:"hoursAvail"`
}

func getDonateData(w http.ResponseWriter, r *http.Request) {
	family, err := getFamilyViaRequest(r)
	if err != nil {
		logger.Println("Failed to retrieve family")
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	fd := new(FamilyData)
	err = fd.init(family, time.Now()) // initialize dashboard for family
	if err != nil {
		logger.Println("Failed to initialize family data")
		logger.Println("Family: ", family)
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	dd := new(DonationData)
	dd.HoursAvail, err = fd.GetAvailableHours()
	if err != nil {
		logger.Println(err)
		w.WriteHeader(http.StatusInternalServerError)
	}

	q := `SELECT family_name, family_id FROM family`
	err = db.Select(&dd.Families, q)
	if err != nil {
		logger.Println(err)
		w.WriteHeader(http.StatusInternalServerError)
	}

	enc := json.NewEncoder(w)
	enc.SetEscapeHTML(true)
	enc.Encode(*dd)
}

func donatePostHandler(w http.ResponseWriter, r *http.Request) {
	body, err := ioutil.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Couldn't parse request", http.StatusBadRequest)
		return
	}
	donMap := make(map[string]interface{})
	err = json.Unmarshal(body, &donMap)
	if err != nil {
		logger.Println(err)
		http.Error(w, "Couldn't unmarshal request", http.StatusBadRequest)
		return
	}

	donation := new(Donation)

	/* Build donation from mapped values */
	donation.Sender, err = getFamilyViaRequest(r)
	if err != nil {
		if csErr, ok := err.(*ClientSafeError); ok {
			http.Error(w, csErr.Error(), http.StatusBadRequest)
		} else {
			http.Error(w, "Couldn't find donor family", http.StatusBadRequest)
		}
		return
	}

	if doneeID, ok := donMap["donee"].(float64); ok {
		donation.Recipient, err = GetFamilyByID(int(doneeID))
		if err != nil {
			if csErr, ok := err.(*ClientSafeError); ok {
				http.Error(w, csErr.Error(), http.StatusBadRequest)
			} else {
				http.Error(w, "Couldn't find donee family", http.StatusBadRequest)
			}
			return
		}
	} else {
		http.Error(w, "Donee ID invalid -- expected number", http.StatusBadRequest)
		return
	}

	if amt, ok := donMap["amount"].(float64); ok {
		donation.Amount = amt;
	} else {
		http.Error(w, "Amount invalid type -- amount must be a number", http.StatusBadRequest)
		return
	}

	// ensure donor family has the funds
	ok, err := donation.isLegal()
	if err != nil {
		if _, ok := err.(*ClientSafeError); ok {
			http.Error(w, err.Error(), http.StatusBadRequest)
		} else {
			http.Error(w, "Couldn't complete donation", http.StatusBadRequest)
		}
		return
	} else if !ok {
		http.Error(w, "Insufficient hours to meet donation requirement", http.StatusBadRequest)
		return
	}

	err = donation.save()
	if err != nil {
		logger.Println(err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	enc := json.NewEncoder(w)
	enc.SetEscapeHTML(true)
	enc.Encode(donation) // send back with id for toaster
}
