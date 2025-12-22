using Microsoft.EntityFrameworkCore;
using FormBuilder.API.Models;

namespace FormBuilder.API.Data
{
    /// <summary>
    /// Contexto de base de datos para la aplicación FormBuilder
    /// </summary>
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        /// <summary>
        /// Tabla de Plantillas
        /// </summary>
        public DbSet<Template> Templates { get; set; }

        /// <summary>
        /// Tabla de Formularios Llenados
        /// </summary>
        public DbSet<FilledForm> FilledForms { get; set; }

        /// <summary>
        /// NUEVO: Tabla de Historial de Versiones de Plantillas
        /// </summary>
        public DbSet<TemplateHistory> TemplateHistory { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Configurar relaciones y índices
            
            // FilledForm -> Template
            modelBuilder.Entity<FilledForm>()
                .HasOne(f => f.Template)
                .WithMany()
                .HasForeignKey(f => f.TemplateID)
                .OnDelete(DeleteBehavior.Cascade);

            // TemplateHistory -> Template
            modelBuilder.Entity<TemplateHistory>()
                .HasOne(h => h.Template)
                .WithMany()
                .HasForeignKey(h => h.TemplateID)
                .OnDelete(DeleteBehavior.Cascade);

            // Índices para mejor performance
            modelBuilder.Entity<Template>()
                .HasIndex(t => t.Codigo)
                .IsUnique();

            modelBuilder.Entity<TemplateHistory>()
                .HasIndex(h => h.TemplateID);

            modelBuilder.Entity<TemplateHistory>()
                .HasIndex(h => h.Version);

            modelBuilder.Entity<TemplateHistory>()
                .HasIndex(h => h.ChangedAt);
        }
    }
}
