require("dotenv").config();

console.log("IMD KEY EXISTS:", !!process.env.IMD_API_KEY);
console.log("IMD KEY LENGTH:", process.env.IMD_API_KEY?.length);



const express = require("express");
const cors = require("cors");
const app = express();
const db = require("./config/db");
const weatherRoutes = require("./routes/weatherRoutes");
const userRouter = require("./routes/userRoute");
const authRoutes = require("./routes/authRoute");
const whatsappRoutes = require("./routes/whatsappRoutes");
const mlRoutes = require("./routes/mlRoutes");

app.use(cors());

app.use(express.json());
app.use(express.urlencoded({extended:true}));

app.post("/test",(req,res)=>{
    res.status(200).json({
        message:"Test route is working"
    });
})

// router
app.use("/",userRouter);
app.use("/api/weather", weatherRoutes);
app.use("/api/whatsapp", whatsappRoutes);
app.use("/api/auth", authRoutes);


app.use("/api/ml", mlRoutes);

app.listen(8081, ()=>{
    console.log("Server is running on port 8080");
})