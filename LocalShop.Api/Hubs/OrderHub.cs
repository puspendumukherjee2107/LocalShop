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

    public async Task SendOrderMessage(string orderId, string senderRole, string senderName, string messageText)
    {
        await Clients.All.SendAsync("ReceiveOrderMessage", new
        {
            orderId,
            senderRole,
            senderName,
            messageText,
            createdAt = DateTime.UtcNow
        });
    }
}
