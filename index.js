const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

dotenv.config();

// middleware 
app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.idwrkpb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    // creating a user collection
    const userCollection = client.db("usersDB").collection("users");
    // console.log("Connected to db");


    // saving the user 
    app.post('/users', async (req, res) => {
      const user = req.body;
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // update createdDate when user sign in 
    app.patch('/users', async (req, res) => {
      const email = req.body.email;
      const filter = { email: email };
      const updateDoc = {
        $set: {
          lastLogin: req.body.lastLogin
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });


    // creating a movies collection for the user if they add any movie 
    const moviesCollection = client.db("usersDB").collection("movies");
    app.post('/movies', async (req, res) => {
      const movie = req.body;
      const result = await moviesCollection.insertOne(movie);
      res.send(result);
    });

    // Get all movies for any user 
    app.get('/movies', async (req, res) => {
      const movies = await moviesCollection.find().toArray();
      res.send(movies);
    });

    // get movie by movie id 
    app.get('/movies/:id', async (req, res) => {
      const id = req.params.id;
      const movie = await moviesCollection.findOne({ _id: new ObjectId(id) });
      res.send(movie);
    });
    
    // delete movie by id
    app.delete('/movies/:id', async (req, res) => {
      const id = req.params.id;
      const result = await moviesCollection.deleteOne({ _id: new ObjectId(id) });
      if (result.deletedCount === 0) {
        return res.status(404).json({ message: "Movie not found" });
      }
      res.json({ message: "Movie deleted successfully" });
    });

    // add to favorite movies
    const favoritesCollection = client.db("usersDB").collection("favorites");

     app.post('/favorites', async (req, res) => {
      const { email, _id } = req.body;

      // Check for duplicate
      const exists = await favoritesCollection.findOne({ email, _id: new ObjectId(_id) });
      if (exists) {
        return res.status(409).json({ error: "Already added to favorites" });
      }

      const result = await favoritesCollection.insertOne(req.body);
      res.status(201).send(result);
    });

    // favorites by user email
    app.get('/favorites/:email', async (req, res) => {
      const email = req.params.email;
      const favorites = await favoritesCollection.find({ email }).toArray();
      res.send(favorites);
    });

// remove a movie from favorites (by favorite ID)
app.delete('/favorites/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const result = await favoritesCollection.deleteOne({ _id:id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Favorite not found' });
    }
    res.json({ message: 'Favorite removed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove favorite' });
  }
});

// making a route for top contributors
app.get('/top-contributors', async (req, res) => {
  try {
    const result = await moviesCollection.aggregate([
      {
        $group: {
          _id: "$userEmail",
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          email: "$_id",
          count: 1,
          _id: 0
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 6
      }
    ]).toArray();

    res.json(result);
  } catch (err) {
    console.error("Error getting top contributors:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

//  update profile for user
app.patch('/users/profile', async (req, res) => {
  try {
    const { email, name, photoURL } = req.body;
    const filter = { email: email };
    
    // First get the current user data
    const user = await userCollection.findOne(filter);
    
    if (!user) {
      return res.status(404).send({ success: false, message: "User not found" });
    }

    // Check if the new values are actually different
    
    const currentName = user.displayName || user.name;
    const currentPhoto = user.photoURL || user.photo;

    if (currentName === name && currentPhoto === photoURL) {
      return res.status(200).send({ 
        success: true, 
        message: "No changes detected", 
        modifiedCount: 0 
      });
    }

    // Update both possible field names to be safe
    const updateDoc = {
      $set: { 
        displayName: name,
        name: name, // Update both fields for consistency
        photoURL: photoURL 
      }
    };

    const result = await userCollection.updateOne(filter, updateDoc);
    res.send({ 
      success: true, 
      modifiedCount: result.modifiedCount,
      message: result.modifiedCount ? "Profile updated" : "No changes made"
    });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).send({ success: false, error: error.message });
  }
});
    
    // Send a ping to confirm a successful connection
    // await client.db("admin"). command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}

app.listen(port, () => {
  // console.log(`Server is running on port ${port}`);
});

run().catch(console.dir);


