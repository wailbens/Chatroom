const path = require('path');
const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const formatMessage = require('./utils/messages');
const { userJoin, getCurrentUser, userLeave, getRoomUsers } = require('./utils/users');
const bcrypt = require('bcrypt');

const app = express();
app.use(express.json());


const server = http.createServer(app);
const io = socketio(server);

users = [];

app.get('/users', (req, res) => {
    res.json(users);
});

app.post('/users/login', async (req, res) => {
    const user = users.find(user => user.name == req.body.name)
    if (user == null) {
        return res.status(400).send('Cannot find user')
    }
    try {
        if ( await bcrypt.compare(req.body.password, user.password)) {
            res.send('Success')
        }else {
            res.send('Not Zbi')
        }
    } catch {
        res.status(500).send()
    }
});

app.post('/users', async (req, res) => {
    try {
        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        const user = {name: req.body.name, password: hashedPassword};
        users.push(user);
        res.status(201).send();
    } catch {
        res.status(500).send();
    }
});

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', socket => {

    socket.on('joinRoom', ({ username, room }) => {
        const user = userJoin(socket.id, username, room);

        socket.join(user.room);

        socket.emit('message', formatMessage('Chatroom', 'Welcome to the Chatroom'));

        socket.broadcast.to(user.room).emit(
            'message',
            formatMessage('Chatroom', `${user.username} has just joined`)
        );

        io.to(user.room).emit('roomUsers', {
            room: user.room,
            users: getRoomUsers(user.room)
        });
    });
    // console.log('new websock connection..');

    socket.on('chatMessage', (msg) => {

        const user = getCurrentUser(socket.id);
        io.to(user.room).emit('message', formatMessage(user.username, msg));
    });

    socket.on('disconnect', () => {
        const user = userLeave(socket.id);

        if (user) {
            io.to(user.room).emit(
                'message',
                formatMessage('Chatroom', `${user.username} has left`)
            );
            io.to(user.room).emit('roomUsers', {
                room: user.room,
                users: getRoomUsers(user.room)
            });
        }

    });

})

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => console.log(`Server running on ${PORT}`));