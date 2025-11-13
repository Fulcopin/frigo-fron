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
    }
}
