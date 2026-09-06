// Modelo para Templates - Models/Template.cs
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FormBuilder.API.Models
{
    [Table("Templates")]
    public class Template
    {
        [Key]
        public int TemplateID { get; set; }

        [Required]
        [MaxLength(50)]
        public string Codigo { get; set; }

        [Required]
        [MaxLength(200)]
        public string Nombre { get; set; }

        [MaxLength(20)]
        public string Version { get; set; } = "1.0";

        [Column(TypeName = "nvarchar(max)")]
        public string Objetivo { get; set; }

        [Column(TypeName = "nvarchar(max)")]
        public string Proceso { get; set; }

        [MaxLength(500)]
        public string CuandoSeUsa { get; set; }

        [MaxLength(200)]
        public string QuienLoLlena { get; set; }

        // Campos del encabezado en formato JSON
        [Column(TypeName = "nvarchar(max)")]
        public string HeaderFields { get; set; }

        // Elementos del cuerpo (secciones y tablas) en formato JSON
        [Column(TypeName = "nvarchar(max)")]
        public string BodyElements { get; set; }

        // Firmas en formato JSON
        [Column(TypeName = "nvarchar(max)")]
        public string Firmas { get; set; }

        // Timestamps
        [Required]
        public DateTime CreatedAt { get; set; }

        public DateTime? UpdatedAt { get; set; }

        // Estado del template
        [MaxLength(50)]
        public string Estado { get; set; } = "Activo"; // Activo, Inactivo, Borrador

        // Usuario que creó el template
        [MaxLength(255)]
        public string CreadoPor { get; set; }

        // Relación inversa con formularios llenados
        public virtual ICollection<FilledForm> FilledForms { get; set; }

        public Template()
        {
            CreatedAt = DateTime.UtcNow;
            FilledForms = new HashSet<FilledForm>();
        }
    }
}
