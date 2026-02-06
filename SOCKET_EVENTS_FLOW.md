# 🔌 Socket.io Events Flow - Satha App

## Complete Event Flow Documentation

### 📨 Chat Events

#### Sending a Message
**Client (Driver or Customer) → Server:**
```javascript
socket.emit("send_message", {
  orderId: 123,
  message: "Hello",
  senderId: 456,
  senderType: 'driver' | 'customer',
  senderName: "John Doe"
});
```

**Server → All clients in room:**
```javascript
io.to(`order_${orderId}`).emit("new_message", {
  id: 789,
  orderId: 123,
  content: "Hello",
  senderId: 456,
  senderType: 'driver',
  senderName: "John Doe",
  createdAt: "2026-02-05T20:00:00Z"
});
```

**Both clients listen for:**
```javascript
socket.on("new_message", (msg) => {
  // Display message
});
```

---

### 🚗 Order Acceptance Flow

#### Driver Accepts Order
**Client (Driver) → Server API:**
```javascript
POST /api/drivers/${driverId}/accept/${requestId}
```

**Server → Customer:**
```javascript
io.to(`order_${requestId}`).emit("status_changed", {
  status: "accepted",
  driverId: 123,
  driverInfo: { name, phone, plateNumber, lat, lng, ... },
  customerInfo: { name, phone, pickupLat, pickupLng, ... }
});
```

**Server → All Drivers:**
```javascript
io.emit("request_removed", { id: requestId });
```

**Client (Driver) locally:**
```javascript
setAvailableRequests(prev => prev.filter(r => r.id !== requestId));
socket.emit("join_order", requestId); // Join chat room
```

---

### ✅ Order Completion Flow

#### Driver Completes Order
**Client (Driver) → Server API:**
```javascript
POST /api/drivers/${driverId}/complete/${requestId}
```

**Server → Customer:**
```javascript
io.to(`order_${requestId}`).emit("status_changed", {
  status: "completed",
  resetToBooking: true
});
```

**Server → All Drivers:**
```javascript
io.emit("request_removed", { id: requestId });
io.emit("update_order_status", { orderId: requestId, status: "completed" });
```

**Client (Customer) reacts:**
```javascript
if (data.status === "completed") {
  setViewState("booking");
  setActiveOrderId(null);
  setDriverInfo(null);
  setMessages([]);
  // ... reset all state
}
```

**Client (Driver) reacts:**
```javascript
setAvailableRequests(prev => prev.filter(r => r.id !== requestId));
setActiveOrder(null);
```

---

### 📍 Location Updates

#### Driver Location Update
**Client (Driver) → Server:**
```javascript
socket.emit("driver_location_update", {
  orderId: activeOrder.id,
  lat: 33.123,
  lng: 44.456,
  heading: 90
});
```

**Server → Customer:**
```javascript
io.to(`order_${orderId}`).emit(`location_changed_order_${orderId}`, {
  lat: 33.123,
  lng: 44.456,
  heading: 90
});
```

**Client (Customer) listens:**
```javascript
socket.on("driver_location_update", (data) => {
  setDriverLocation([data.lat, data.lng]);
  setDriverHeading(data.heading);
});
```

---

### 🔄 Order State Sync Events

#### New Request Available
**Server → All Drivers in City:**
```javascript
io.to(`city_${city}`).emit("new_request_available", {
  id, city, pickupAddress, destination, price, status: "pending", ...
});
```

#### Request Removed (accepted/completed by someone)
**Server → All Drivers:**
```javascript
io.emit("request_removed", { id: requestId });
```

#### Order Status Update
**Server → All Drivers:**
```javascript
io.emit("update_order_status", {
  orderId: requestId,
  status: "completed" | "accepted" | "confirmed"
});
```

**Client (All Drivers) react:**
```javascript
socket.on("update_order_status", (data) => {
  if (data.status === 'completed' || data.status === 'accepted') {
    setAvailableRequests(prev => prev.filter(r => r.id !== data.orderId));
  }
});
```

---

### 🚪 Room Management

#### Customer Joins Order Room
```javascript
socket.emit("join_order", orderId);
// Server: socket.join(`order_${orderId}`)
```

#### Driver Joins Order Room (on accept)
```javascript
socket.emit("join_order", orderId);
// Server: socket.join(`order_${orderId}`)
```

#### Driver Joins City Room (on online)
```javascript
socket.emit("join_city", city);
// Server: socket.join(`city_${city}`)
```

#### Driver Joins Private Room
```javascript
socket.emit("join_driver_room", driverId);
// Server: socket.join(`driver_${driverId}`)
```

---

## 🎯 Key Improvements Made

1. **Unified Chat Events**: Both sides now use `new_message` event
2. **Proper Payloads**: All messages include required metadata
3. **Immediate Order Removal**: Orders removed from lists instantly on accept/complete
4. **Broadcast to All**: Completion events broadcasted to all drivers to update their lists
5. **Room Joining**: Drivers join order room immediately after acceptance for chat

---

## 🧪 Testing Socket Events

### Test Chat:
1. Driver sends message → Check customer receives it
2. Customer sends message → Check driver receives it
3. Verify no duplicates appear
4. Check message formatting (sender name, timestamp)

### Test Order Flow:
1. Driver accepts → Check order removed from all drivers' lists
2. Driver accepts → Check customer sees driver info immediately
3. Driver completes → Check customer view resets to booking
4. Driver completes → Check order doesn't reappear in any driver's list

### Test Location:
1. Driver moves → Check customer sees updated location in real-time
2. Verify navigation line updates with new location
3. Check heading/rotation updates

---

## 📝 Event Naming Convention

- `send_message` → Sending a chat message
- `new_message` → Receiving a chat message
- `status_changed` → Order status changed (for customer)
- `update_order_status` → Order status changed (broadcast to all)
- `request_removed` → Order no longer available (broadcast to all)
- `driver_location_update` → Driver's location changed
- `new_request_available` → New order available in city
- `join_order` → Join order chat room
- `join_city` → Join city broadcast room
- `join_driver_room` → Join driver's private room
