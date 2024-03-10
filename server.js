import express, { json } from 'express'; // Importing express and json middleware
import { MongoClient } from 'mongodb'; // Importing MongoClient from mongodb
import * as dotenv from 'dotenv'; // Importing dotenv for environment variables

const app = express(); // Creating an Express app
app.use(json()); // Using json middleware to parse JSON requests
dotenv.config(); // Loading environment variables from .env file

// MongoDB connection setup
const mongoURI = process.env.MongoDB_URL; // Getting MongoDB URI from environment variables
const dbName = 'HallBookingAPI'; // Database name
const client = new MongoClient(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true }); // Creating a new MongoDB client instance

let roomsCollection; // Collection for rooms
let bookingsCollection; // Collection for bookings

// Function to connect to MongoDB
async function connectToMongo() {
    try {
        await client.connect(); // Connecting to MongoDB
        const db = client.db(dbName); // Getting the database
        roomsCollection = db.collection('rooms'); // Getting rooms collection
        bookingsCollection = db.collection('bookings'); // Getting bookings collection
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('Failed to connect to MongoDB:', error);
    }
}

connectToMongo(); // Calling the function to connect to MongoDB

// Endpoint to create a room
app.post('/rooms', async (req, res) => {
    try {
        const room = await roomsCollection.insertOne(req.body); // Inserting a new room document
        res.status(201).send('Room Created'); // Sending success response
    } catch (error) {
        res.status(500).json({ error: 'Failed to create room' }); // Sending error response
    }
});

// Endpoint to book a room
app.post('/bookings', async (req, res) => {
  try {
      const { roomId, date, start, end } = req.body;

      // Check if the room is already booked for the given date and time
      const existingBooking = await bookingsCollection.findOne({
          roomId: roomId,
          date: date,
          $or: [
              { start: { $lte: start }, end: { $gte: start } }, // Check if start time is between existing booking
              { start: { $lte: end }, end: { $gte: end } }, // Check if end time is between existing booking
              { start: { $gte: start }, end: { $lte: end } } // Check if existing booking is within the new booking time
          ]
      });

      if (existingBooking) {
          res.status(400).json({ error: 'Room already booked for the given date and time' });
          return;
      }

      // If room is available, proceed with the booking
      const booking = await bookingsCollection.insertOne(req.body);
      res.status(201).send('Room Booked');
  } catch (error) {
      res.status(500).json({ error: 'Failed to book room' });
  }
});

// Endpoint to list all rooms with booked data
app.get('/rooms/bookings', async (req, res) => {
  try {
      const rooms = await roomsCollection.find().toArray(); // Getting all rooms
      const result = [];

      for (const room of rooms) {
          const bookings = await bookingsCollection.find({ roomId: room.roomId }).toArray(); // Getting bookings for each room

          for (const booking of bookings) {
              result.push({
                  roomName: room.name,
                  roomId:room.roomId,
                  bookedStatus: booking.status,
                  customerName: booking.customerName,
                  date: booking.date,
                  startTime: booking.start,
                  endTime: booking.end
              });
          }
      }

      res.json(result); // Sending the result
  } catch (error) {
      res.status(500).json({ error: 'Failed to fetch room bookings' }); // Sending error response
  }
});

// Endpoint to list all customers with booked data
app.get('/customers/bookings', async (req, res) => {
    try {
        const bookings = await bookingsCollection.find().toArray(); // Getting all bookings
        const result = [];
        for (const booking of bookings) {
            const rooms = await roomsCollection.find({ roomId: booking.roomId}).toArray(); // Getting rooms for each booking
            for(const room of rooms){
            result.push({
                customerName: booking.customerName,
                roomName: room.name,
                date: booking.date,
                startTime: booking.start,
                endTime: booking.end
            });
          }
        }
        res.json(result); // Sending the result
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch customer bookings' }); // Sending error response
    }
});

// Endpoint to list how many times a customer has booked a room 

app.get('/customers/:name', async (req, res) => {
  const { name } = req.params;

  try {
      const customerBookings = await bookingsCollection.find({ customerName: name }).toArray(); // Finding bookings for the specified customer

      if (!customerBookings) {
          res.status(404).json({ error: 'Customer not found or has no bookings' }); // Sending error response if customer not found
          return;
      }
      const result = customerBookings.map(booking => ({ // Mapping the bookings
        customerName: booking.customerName,
        roomName: booking.roomId,
        date: booking.date,
        startTime: booking.start,
        endTime: booking.end,
        bookingId: booking._id,
        bookingDate: booking.date,
        bookingStatus: booking.status
    }));
    res.json(result); // Sending the result
  } catch (error) {
      res.status(500).json({ error: 'Failed to fetch customer bookings' }); // Sending error response
  }
});

// Default route
app.get('/',(req,res)=>{
  res.status(200).send('Welcome to Hall Booking App') // Sending a welcome message
})

const PORT = process.env.PORT || 3000; // Setting up the port
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`); // Starting the server
});
