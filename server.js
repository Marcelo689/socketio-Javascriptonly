const express = require('express');
const { createServer } = require('node:http');
const { join } = require('node:path');
const { Server } = require('socket.io');
const sqlite3 = require("sqlite3");
const {open} = require("sqlite");

async function main(){
    const db = await open({
        filename: "chat.db",
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS messages(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_offset TEXT UNIQUE,
            content TEXT
        );
    `);

    const app = express();
    const server = createServer(app);
    const io = new Server(server, {
        connectionStateRecovery: {}
    });

    app.get('/', (req, res) => {
    res.sendFile(join(__dirname, `index.html`));
    });

    io.on(`connection`, async (socket) => {
        socket.join("room1");
        socket.emit("chat message", "boas vindas ao saguao 1");

        socket.on("entrarSala", salaName => {
            socket.join(salaName);
            socket.emit("chat message", "entrou na sala "+ salaName);
        });

        socket.on("todosForaSala", mensagem => {
            io.except("room1").emit("chat message", mensagem);
        })

        socket.on("sairSala", socketId =>{
            socket.leave("room1");
            socket.emit("chat message", "saiu da sala room1  usuario = " + socketId);
        })

        socket.on("chat message",async (msg) =>{
            let result;
            try{
                result = await db.run('INSERT INTO messages (content) VALUES(?)', msg);
            }catch(e){
                console.log(e)
                return;
            }

            io.emit("chat message", msg, result.lastID);
        })

        if(!socket.recovered){
            try{
                await db.each("SELECT id, content FROM messages WHERE id > ?",
                
                [socket.handshake.auth.serverOffset || 0],
                (_err, row) => {
                    socket.emit("chat message", row.content, row.id);
                })
            }catch(e){

            }
        }

        socket.on("disconected", () => console.log("user disconected"));
    });

    server.listen(3000, () => {
        console.log('server running at http://localhost:3000');
    });
}

main();