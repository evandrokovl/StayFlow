-- MySQL dump 10.13  Distrib 8.0.45, for Win64 (x86_64)
--
-- Host: localhost    Database: meusistema
-- ------------------------------------------------------
-- Server version	8.0.45

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `reservations`
--

DROP TABLE IF EXISTS `reservations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reservations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `property_id` int NOT NULL,
  `guest_name` varchar(150) DEFAULT NULL,
  `source` enum('manual','blocked','airbnb','booking','bloqueio') NOT NULL DEFAULT 'manual',
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `status` enum('confirmed','cancelled') DEFAULT 'confirmed',
  `external_id` varchar(255) DEFAULT NULL,
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `guest_email` varchar(255) DEFAULT NULL,
  `guest_phone` varchar(50) DEFAULT NULL,
  `total_amount` decimal(10,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_external_reservation` (`property_id`,`source`,`external_id`),
  UNIQUE KEY `unique_property_external_id` (`property_id`,`external_id`),
  UNIQUE KEY `unique_property_external` (`property_id`,`external_id`),
  KEY `idx_reservations_property` (`property_id`),
  KEY `idx_reservations_dates` (`start_date`,`end_date`),
  KEY `idx_reservations_external` (`external_id`),
  CONSTRAINT `reservations_ibfk_1` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `reservations`
--

LOCK TABLES `reservations` WRITE;
/*!40000 ALTER TABLE `reservations` DISABLE KEYS */;
INSERT INTO `reservations` VALUES (1,1,'Mariana Souza','manual','2026-04-08','2026-04-12','confirmed',NULL,'Reserva manual de teste','2026-04-07 00:04:05',NULL,NULL,NULL),(2,1,'Hóspede Airbnb','airbnb','2026-04-15','2026-04-18','confirmed','airbnb_001','Importado do Airbnb','2026-04-07 00:04:05',NULL,NULL,NULL),(3,1,'Bloqueio','blocked','2026-04-22','2026-04-24','confirmed',NULL,'Bloqueio para manutenção','2026-04-07 00:04:05',NULL,NULL,NULL),(4,2,'Carlos Pereira','manual','2026-04-10','2026-04-14','confirmed',NULL,'Reserva manual','2026-04-07 00:04:05',NULL,NULL,NULL),(5,2,'Bloqueio','blocked','2026-04-18','2026-04-20','confirmed',NULL,'Bloqueio interno','2026-04-07 00:04:05',NULL,NULL,NULL),(6,2,'Família Booking','booking','2026-04-25','2026-04-30','confirmed','booking_001','Importado do Booking','2026-04-07 00:04:05',NULL,NULL,NULL),(7,3,'Ana Clara','manual','2026-04-09','2026-04-11','confirmed',NULL,'Estadia curta','2026-04-07 00:04:05',NULL,NULL,NULL),(8,3,'Executivo Booking','booking','2026-04-13','2026-04-16','confirmed','booking_002','Reserva externa','2026-04-07 00:04:05',NULL,NULL,NULL),(9,3,'Bloqueio','blocked','2026-04-20','2026-04-21','confirmed',NULL,'Ajuste operacional','2026-04-07 00:04:05',NULL,NULL,NULL),(10,3,NULL,'manual','2026-04-15','2026-04-23','confirmed',NULL,NULL,'2026-04-09 00:16:19',NULL,NULL,NULL),(11,1,NULL,'manual','2026-04-15','2026-04-24','confirmed',NULL,NULL,'2026-04-09 00:23:05',NULL,NULL,NULL),(12,4,'João Silva','airbnb','2026-05-10','2026-05-15','confirmed','test_airbnb_789','Reserva criada automaticamente via inbound (reservas@airbnb.com)','2026-04-14 18:50:04','joao@email.com','123456789',1500.00),(13,4,'João Silva','airbnb','2026-05-10','2026-05-15','confirmed','993ebf43-5402-4ea4-b539-1cfcc1fe18d1','Reserva criada automaticamente via inbound (evandro61587926@alunos.sc.senac.br)','2026-04-16 18:32:51',NULL,'2026-05-10',1500.00),(14,4,'João Silva','airbnb','2026-05-10','2026-05-15','confirmed','84923ce8-5972-4b8e-8c25-804e46f2c08d','Reserva criada automaticamente via inbound (evandro61587926@alunos.sc.senac.br)','2026-04-16 18:38:51',NULL,NULL,1500.00),(15,4,'João Silva','airbnb','2026-05-10','2026-05-15','confirmed','f5e9e576-1a1c-4f30-a4ff-b68aac480cc0','Reserva criada automaticamente via inbound (evandro61587926@alunos.sc.senac.br)','2026-04-16 18:55:52',NULL,NULL,1500.00),(16,4,'João Silva','airbnb','2026-05-12','2026-05-18','cancelled','128212cd-21e0-4e33-86e2-347b00825546','Reserva cancelada automaticamente via inbound (evandro61587926@alunos.sc.senac.br)','2026-04-16 19:08:51',NULL,NULL,1800.00);
/*!40000 ALTER TABLE `reservations` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-04-20 20:30:39
