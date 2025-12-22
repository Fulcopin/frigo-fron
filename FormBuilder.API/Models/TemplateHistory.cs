using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FormBuilder.API.Models
{
    /// <summary>
    /// Modelo para almacenar el historial de versiones de las plantillas.
    /// Cada vez que se actualiza una plantilla, se guarda un snapshot completo.
    /// </summary>
    public class TemplateHistory
    {
        /// <summary>
        /// ID único del registro de historial
        /// </summary>
        [Key]
        public int HistoryID { get; set; }
        
        /// <summary>
        /// ID de la plantilla asociada
        /// </summary>
        [Required]
        public int TemplateID { get; set; }
        
        /// <summary>
        /// Snapshot completo de la plantilla en este punto del tiempo (JSON)
        /// </summary>
        [Required]
        public string TemplateSnapshot { get; set; }
        
        /// <summary>
        /// Versión específica de la plantilla (ej: "02-01")
        /// </summary>
        [Required]
        [MaxLength(20)]
        public string Version { get; set; }
        
        /// <summary>
        /// Tipo de cambio realizado
        /// </summary>
        [MaxLength(50)]
        public string ChangeType { get; set; } // "Created", "Updated", "Restored"
        
        /// <summary>
        /// Descripción detallada de los cambios realizados
        /// </summary>
        public string ChangeDescription { get; set; }
        
        /// <summary>
        /// Usuario que realizó el cambio (para futuras implementaciones de auth)
        /// </summary>
        [MaxLength(100)]
        public string ChangedBy { get; set; }
        
        /// <summary>
        /// Fecha y hora en que se realizó el cambio
        /// </summary>
        [Required]
        public DateTime ChangedAt { get; set; }
        
        /// <summary>
        /// Relación navegacional con la plantilla
        /// </summary>
        [ForeignKey("TemplateID")]
        public Template Template { get; set; }
    }
}
