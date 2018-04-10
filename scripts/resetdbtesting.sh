#!/bin/sh

# Assuming postgres is installed, and setup for your
# user to have acccess,  this script will create/reset
# the your caraway db with only the testing data.
echo "DROP DATABASE caraway" | psql postgres
psql postgres < ../database/dbinit.sql
psql caraway  < ../database/data.sql
