// Modelos para Entity Framework - Models/FilledForm.cs
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FormBuilder.API.Models
{
    [Table("FilledForms")]
    public class FilledForm
    {
        [Key]
        public int FormID { get; set; }

        [Required]
        public int TemplateID { get; set; }

        // Relación con la tabla Templates
        [ForeignKey("TemplateID")]
        public virtual Template Template { get; set; }

        // Datos del encabezado en formato JSON
        [Column(TypeName = "nvarchar(max)")]
        public string HeaderData { get; set; }

        // Datos del cuerpo en formato JSON (reemplaza TableRows)
        [Column(TypeName = "nvarchar(max)")]
        public string BodyData { get; set; }

        // Datos de firmas en formato JSON
        [Column(TypeName = "nvarchar(max)")]
        public string FirmasData { get; set; }

        // Observaciones adicionales
        [Column(TypeName = "nvarchar(max)")]
        public string Observaciones { get; set; }

        // Timestamps
        [Required]
        public DateTime CreatedAt { get; set; }

        public DateTime? UpdatedAt { get; set; }

        // Estado del formulario (opcional)
        [MaxLength(50)]
        public string Estado { get; set; } = "Borrador"; // Borrador, Enviado, Aprobado, etc.

        // Usuario que creó el formulario (opcional)
        [MaxLength(255)]
        public string CreadoPor { get; set; }

        // Usuario que modificó el formulario (opcional)
        [MaxLength(255)]
        public string ModificadoPor { get; set; }

        // ========================================
        // CAMPOS NUEVOS: Conversión de Unidades
        // ========================================

        // Peso en Libras (unidad del sistema)
        [Column(TypeName = "decimal(18,2)")]
        public decimal? PesoLb { get; set; }

        // Peso en Kilogramos (para exportación/Inforbusiness)
        [Column(TypeName = "decimal(18,2)")]
        public decimal? PesoKg { get; set; }

        // Unidad original del peso
        [MaxLength(10)]
        public string? UnidadPeso { get; set; } = "lb";

        // Lotes/Batches separados por espacios
        [MaxLength(500)]
        public string? Batches { get; set; }

        // Producto/Nombre (para búsquedas más fáciles)
        [MaxLength(200)]
        public string? Producto { get; set; }

        // Propiedad calculada: Array de lotes
        [NotMapped]
        public string[] BatchArray => 
            string.IsNullOrWhiteSpace(Batches) 
                ? Array.Empty<string>() 
                : Batches.Split(' ', StringSplitOptions.RemoveEmptyEntries);

        // Propiedad calculada: Conversión automática lb → kg
        [NotMapped]
        public decimal PesoKgCalculado => 
            PesoLb.HasValue 
                ? Math.Round(PesoLb.Value * 0.453592m, 2)
                : 0;

        // Propiedad calculada: Conversión automática kg → lb
        [NotMapped]
        public decimal PesoLbCalculado => 
            PesoKg.HasValue 
                ? Math.Round(PesoKg.Value * 2.20462m, 2)
                : 0;

        // ========================================
        // CAMPOS NUEVOS: Sistema de Versiones
        // ========================================

        /// <summary>
        /// Versión de la plantilla usada al momento de crear el formulario
        /// </summary>
        public int? TemplateVersion { get; set; }

        /// <summary>
        /// Snapshot completo de la plantilla en formato JSON
        /// Guarda la estructura exacta al momento de crear el formulario
        /// </summary>
        [Column(TypeName = "nvarchar(max)")]
        public string? TemplateSnapshot { get; set; }

        /// <summary>
        /// Fecha de la versión de la plantilla
        /// Permite rastrear cuándo se creó/modificó la versión
        /// </summary>
        public DateTime? FechaVersion { get; set; }
    }
}
