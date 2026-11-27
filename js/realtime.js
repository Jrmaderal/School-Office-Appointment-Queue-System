const socket = io({
    transports: ['websocket']
});

async function refreshQueue() {
    try {
        await QueueManager.syncFromServer();
        App.navigate(App.currentPage || 'dashboard');
        console.log('Queue data synchronized');

    } catch (error) {
        console.error('Synchronization error:', error);
    }
}

socket.on('connect', () => {
    console.log('WebSocket connected');
    refreshQueue();
});

socket.on('queueUpdated', () => {
    console.log('Real-time queue update received');
    refreshQueue();
});

socket.on('disconnect', () => {
    console.log('WebSocket disconnected');
});
