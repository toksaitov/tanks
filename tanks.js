// Загрузка библиотек
const express = require('express')
const app = express()
const http = require('http').Server(app)
const io = require('socket.io')(http)
const uniqueString = require('unique-string')

// Параметры сервера
const port = 8090
const tick = 100

// Данные игры
const fieldWidth  = 20
const fieldHeight = 20
const bases = [
    {
        'x': 0, 'y': 0,
        'dx': 1, 'dy': 0,
        'c': 'red'
    },
    {
        'x': fieldWidth - 1, 'y': 0,
        'dx': -1, 'dy': 0,
        'c': 'green'
    },
    {
        'x': fieldWidth - 1, 'y': fieldHeight - 1,
        'dx': -1, 'dy': 0,
        'c': 'blue'
    },
    {
        'x': 0, 'y': fieldHeight - 1,
        'dx': 1, 'dy': 0,
        'c': 'yellow'
    }
]

// Состояние игры
const gameObjects = { }

// Функции передачи состояния игры на клиенты (в браузеры)
const sendGameState = () => {
    io.emit('upd', gameObjects)
}
const sendGameObjectUpdate = id => {
    const msg = { }; msg[id] = gameObjects[id]
    io.emit('upd', msg)
}
const destroyGameObject = objectsToDestroy => {
    io.emit('dstr', objectsToDestroy)
    for (const gameObject of objectsToDestroy) {
        delete gameObjects[gameObject]
    }
}

// Передача файлов браузерам из папки public
app.use(express.static('public'))

// Обработка подключения клиента
io.on('connection', socket => {
    console.log(`New client ${socket.id}`) // отладочные лог сообщения для разработчика

    // Проверка доступности базы
    const base = bases.shift()
    if (!base) {
        socket.disconnect()
        return
    }

    // Создаем танк для подключившегося клиента
    gameObjects[socket.id] = {
        'x': base.x,
        'y': base.y,
        'dx': base.dx,
        'dy': base.dy,
        'c': base.c,
        't': 't'
    }
    sendGameState(); // предаем новому клиенту ВСЕ состояние игры на данный момент

    // Обработка нажатий клавиши из бразуера клиента
    socket.on('cmd', key => {
        console.log(`Client ${socket.id} command ${key}`)

        let tank = gameObjects[socket.id]
        switch (key) {
            case 'w':
                tank.dx = 0; tank.dy = -1
                break;
            case 'a':
                tank.dx = -1; tank.dy = 0
                break;
            case 's':
                tank.dx = 0; tank.dy = 1
                break;
            case 'd':
                tank.dx = 1; tank.dy = 0
                break;
            case ' ':
                // Создаем новый снаряд
                const bulletID = uniqueString()
                const x = tank.x + tank.dx
                const y = tank.y + tank.dy
                gameObjects[bulletID] = {
                    'x': x,
                    'y': y,
                    'dx': tank.dx,
                    'dy': tank.dy,
                    'c': 'white',
                    't': 'b'
                }
                sendGameObjectUpdate(bulletID)

                console.log(`Client ${socket.id} shot`)
                break
        }
        switch (key) { // Двигаем танк
            case 'w':
            case 'a':
            case 's':
            case 'd':
                tank.x = Math.max(Math.min(tank.x + tank.dx, fieldWidth - 1), 0)
                tank.y = Math.max(Math.min(tank.y + tank.dy, fieldHeight - 1), 0)
                sendGameObjectUpdate(socket.id)
                break
        }

        console.log(`Client ${socket.id} tank state: [${tank.x}, ${tank.y}, ${tank.dx}, ${tank.dy}]`)
    })

    // Обработка отключившегося клиента
    socket.on('disconnect', () => {
        console.log(`Client ${socket.id} disconnected`)

        destroyGameObject([socket.id])
    })
})

// Запуск сервера HTTP
http.listen(port, () => { // порт для HTTP без указания в адресной строке 80
    console.log(`The Tanks server is listening on port ${port}`)

    // Тик (обновления) сервера
    setInterval(() => {
        // Движение пуль
        for (const [id, gameObject] of Object.entries(gameObjects)) {
            if (gameObject.t == 't') continue

            const bullet = gameObject
            bullet.x += bullet.dx
            bullet.y += bullet.dy
            sendGameObjectUpdate(id)
            
            if (bullet.x < 0 || bullet.x >= fieldWidth ||
                bullet.y < 0 || bullet.y >= fieldHeight) {
                destroyGameObject([id])
            }
        }

        // Проверка столкновений
        for (const [id, gameObject] of Object.entries(gameObjects)) {
            for (const [otherID, otherGameObject] of Object.entries(gameObjects)) {
                if (gameObject == otherGameObject) continue
                if (gameObject.x == otherGameObject.x &&
                    gameObject.y == otherGameObject.y) {
                    destroyGameObject([id, otherID])
                }
            }
        }
    }, tick)
})
