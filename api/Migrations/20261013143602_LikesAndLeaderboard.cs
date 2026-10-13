using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace NakcatApi.Migrations
{
    /// <inheritdoc />
    public partial class LikesAndLeaderboard : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Likes",
                table: "CatStories",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "BreedLikes",
                columns: table => new
                {
                    Breed = table.Column<string>(type: "text", nullable: false),
                    Count = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BreedLikes", x => x.Breed);
                });

            migrationBuilder.CreateTable(
                name: "MemoryScores",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PlayerName = table.Column<string>(type: "text", nullable: false),
                    Moves = table.Column<int>(type: "integer", nullable: false),
                    Seconds = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MemoryScores", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "BreedLikes",
                columns: new[] { "Breed", "Count" },
                values: new object[,]
                {
                    { "Abyssinian", 0 },
                    { "American Shorthair", 0 },
                    { "Australian Mist", 0 },
                    { "Bengal", 0 },
                    { "Birman", 0 },
                    { "British Shorthair", 0 },
                    { "Burmilla", 0 },
                    { "Chinchilla Persian", 0 },
                    { "Exotic Shorthair", 0 },
                    { "Khao Manee", 0 },
                    { "Korat", 0 },
                    { "Maine Coon", 0 },
                    { "Munchkin", 0 },
                    { "Norwegian Forest", 0 },
                    { "Ocicat", 0 },
                    { "Persian", 0 },
                    { "RagaMuffin", 0 },
                    { "Ragdoll", 0 },
                    { "Russian Blue", 0 },
                    { "Scottish Fold", 0 },
                    { "Siamese", 0 },
                    { "Sphynx", 0 }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BreedLikes");

            migrationBuilder.DropTable(
                name: "MemoryScores");

            migrationBuilder.DropColumn(
                name: "Likes",
                table: "CatStories");
        }
    }
}
