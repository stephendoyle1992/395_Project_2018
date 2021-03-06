package main

import (
	"flag"
	"html/template"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gorilla/sessions"
	"github.com/jmoiron/sqlx"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

var db *sqlx.DB
var logger *log.Logger
var tmpls *template.Template

type args struct {
	ServerPort string
	LogName    string
}

// Args used to hold any command line arguments
var Args args

var store = sessions.NewCookieStore([]byte(time.Now().String()))

func init() {
	flag.Usage = func() {
		flag.PrintDefaults()
	}

	flag.StringVar(&Args.LogName, "l", "os.Stderr", "set logfile name")
	flag.StringVar(&Args.ServerPort, "p", ":8080", "set webserver port")

	flag.Parse()

	if Args.LogName != "os.Stderr" {
		f, err := os.OpenFile(Args.LogName, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
		if err != nil {
			log.Fatal(err)
		}
		logger = log.New(f, "status: ", log.LstdFlags|log.Lshortfile)
	} else {
		logger = log.New(os.Stderr, "status: ", log.LstdFlags|log.Lshortfile)
	}

	store.Options = &sessions.Options{
		Path:     "/",
		MaxAge:   3600, // 1 hour
		HttpOnly: true,
	}

}

func parseTemplates() error {
	var allFiles []string

	files, err := ioutil.ReadDir("./views/templates")

	if err != nil {
		return err
	}
	for _, file := range files {
		filename := file.Name()
		if strings.HasSuffix(filename, ".tmpl") {
			allFiles = append(allFiles, "./views/templates/"+filename)
		}
	}
	tmpls, err = template.ParseFiles(allFiles...) //parses all .tmpl files in the 'templates' folder
	if err != nil {
		return err
	}
	return nil
}

func startDb() error {
	// open env file
	logger.Println("Reading DB data from env file...")
	err := godotenv.Load()
	if err != nil {
		log.Fatal("Error loading .env file")
	}
	psqlInfo := os.Getenv("DATABASE_URL")

	logger.Println("Opening database...")
	db, err = sqlx.Connect("postgres", psqlInfo)
	return err

}

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Fatal("Error loading .env file")
	}
	port := os.Getenv("PORT")
	logger.Println(port)

	err = startDb()
	if err != nil {
		panic(err)
	}
	defer db.Close()
	logger.Println("Database opened and pinged.....")

	r, err := createRouter()
	if err != nil {
		log.Fatal("Could not create router")
	}
	logger.Println("Routes created")
	err = parseTemplates()
	if err != nil {
		logger.Println(err)
		log.Fatal("Could not parse golang html templates")
	}
	logger.Println("Golang html templates parsed successfully")

	logger.Println("Server running......")
	err = http.ListenAndServe(":"+port, r)
	if err != nil {
		log.Fatal("Could not start server")
	}
}
