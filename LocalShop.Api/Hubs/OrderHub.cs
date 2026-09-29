using Microsoft.AspNetCore.SignalR;

namespace LocalShop.Api.Hubs;

public class OrderHub : Hub
{
    public async Task JoinShopGroup(string shopName)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, shopName);
    }

    public async Task LeaveShopGroup(string shopName)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, shopName);
    }

    public async Task JoinOrderGroup(string orderId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"order_{orderId}");
    }

    public async Task LeaveOrderGroup(string orderId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"order_{orderId}");
    }

    public async Task SendOrderMessage(string orderId, string senderRole, string senderName, string messageText)
    {
        var payload = new
        {
            orderId,
            senderRole,
            senderName,
            messageText,
            createdAt = DateTime.UtcNow
        };

        // Send to targeted order group and all listeners subscribed
        await Clients.Group($"order_{orderId}").SendAsync("ReceiveOrderMessage", payload);
        await Clients.All.SendAsync("ReceiveOrderMessage", payload);
    }
}
