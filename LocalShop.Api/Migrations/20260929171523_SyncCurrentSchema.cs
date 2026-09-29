using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LocalShop.Api.Migrations
{
    /// <inheritdoc />
    public partial class SyncCurrentSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "FailedLoginAttempts",
                table: "Users",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "LockoutUntilUtc",
                table: "Users",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OwnerName",
                table: "StoreProfiles",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Phone",
                table: "StoreProfiles",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ShopName",
                table: "Products",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "IsDeletedByCustomer",
                table: "Orders",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeletedByMerchant",
                table: "Orders",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "StockRestored",
                table: "Orders",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsAvailable",
                table: "OrderItems",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FailedLoginAttempts",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "LockoutUntilUtc",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "OwnerName",
                table: "StoreProfiles");

            migrationBuilder.DropColumn(
                name: "Phone",
                table: "StoreProfiles");

            migrationBuilder.DropColumn(
                name: "ShopName",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "IsDeletedByCustomer",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "IsDeletedByMerchant",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "StockRestored",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "IsAvailable",
                table: "OrderItems");
        }
    }
}
