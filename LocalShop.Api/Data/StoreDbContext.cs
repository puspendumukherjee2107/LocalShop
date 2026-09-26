using Microsoft.EntityFrameworkCore;
using LocalShop.Api.Models;

namespace LocalShop.Api.Data;

public class StoreDbContext : DbContext
{
    public StoreDbContext(DbContextOptions<StoreDbContext> options) : base(options) { }

    public DbSet<Product> Products => Set<Product>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Staff> StaffMembers => Set<Staff>();
    public DbSet<Settlement> Settlements => Set<Settlement>();
    public DbSet<StoreProfile> StoreProfiles => Set<StoreProfile>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<OrderMessage> OrderMessages => Set<OrderMessage>();
    public DbSet<Coupon> Coupons => Set<Coupon>();
    public DbSet<CustomerAddress> CustomerAddresses => Set<CustomerAddress>();
}