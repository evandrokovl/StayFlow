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
-- Table structure for table `message_logs`
--

DROP TABLE IF EXISTS `message_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `message_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `automation_id` int NOT NULL,
  `template_id` int DEFAULT NULL,
  `reservation_id` int NOT NULL,
  `property_id` int NOT NULL,
  `channel` varchar(20) DEFAULT 'email',
  `guest_name` varchar(150) DEFAULT NULL,
  `guest_contact` varchar(255) DEFAULT NULL,
  `subject` varchar(255) DEFAULT NULL,
  `body_rendered` text NOT NULL,
  `scheduled_for` datetime NOT NULL,
  `processed_at` datetime DEFAULT NULL,
  `sent_at` datetime DEFAULT NULL,
  `status` varchar(20) DEFAULT 'pending',
  `external_id` varchar(255) DEFAULT NULL,
  `error_message` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_automation_reservation_schedule` (`automation_id`,`reservation_id`,`scheduled_for`),
  UNIQUE KEY `unique_message_log` (`automation_id`,`reservation_id`,`scheduled_for`),
  KEY `automation_id` (`automation_id`),
  KEY `reservation_id` (`reservation_id`),
  KEY `property_id` (`property_id`),
  KEY `idx_message_logs_template_id` (`template_id`),
  CONSTRAINT `fk_message_logs_template` FOREIGN KEY (`template_id`) REFERENCES `message_templates` (`id`) ON DELETE SET NULL,
  CONSTRAINT `message_logs_ibfk_1` FOREIGN KEY (`automation_id`) REFERENCES `message_automations` (`id`),
  CONSTRAINT `message_logs_ibfk_2` FOREIGN KEY (`reservation_id`) REFERENCES `reservations` (`id`),
  CONSTRAINT `message_logs_ibfk_3` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `message_logs`
--

LOCK TABLES `message_logs` WRITE;
/*!40000 ALTER TABLE `message_logs` DISABLE KEYS */;
INSERT INTO `message_logs` VALUES (1,2,NULL,1,1,'email','Mariana Souza',NULL,'Sua chegada está próxima','Olá, Mariana Souza! Sua reserva no imóvel Loft Centro Floripa começa em 08/04/2026.','2026-04-06 09:00:00',NULL,NULL,'needs_contact',NULL,'Hóspede sem email disponível para automação de email','2026-04-08 00:12:52'),(2,2,NULL,2,1,'email','Hóspede Airbnb',NULL,'Sua chegada está próxima','Olá, Hóspede Airbnb! Sua reserva no imóvel Loft Centro Floripa começa em 15/04/2026.','2026-04-13 09:00:00',NULL,NULL,'needs_contact',NULL,'Hóspede sem email disponível para automação de email','2026-04-08 00:12:52'),(3,2,NULL,3,1,'email','Bloqueio',NULL,'Sua chegada está próxima','Olá, Bloqueio! Sua reserva no imóvel Loft Centro Floripa começa em 22/04/2026.','2026-04-20 09:00:00',NULL,NULL,'needs_contact',NULL,'Hóspede sem email disponível para automação de email','2026-04-08 00:12:52'),(4,2,NULL,4,2,'email','Carlos Pereira',NULL,'Sua chegada está próxima','Olá, Carlos Pereira! Sua reserva no imóvel Casa Praia Campeche começa em 10/04/2026.','2026-04-08 09:00:00',NULL,NULL,'needs_contact',NULL,'Hóspede sem email disponível para automação de email','2026-04-08 00:12:52'),(5,2,NULL,5,2,'email','Bloqueio',NULL,'Sua chegada está próxima','Olá, Bloqueio! Sua reserva no imóvel Casa Praia Campeche começa em 18/04/2026.','2026-04-16 09:00:00',NULL,NULL,'needs_contact',NULL,'Hóspede sem email disponível para automação de email','2026-04-08 00:12:52'),(6,2,NULL,6,2,'email','Família Booking',NULL,'Sua chegada está próxima','Olá, Família Booking! Sua reserva no imóvel Casa Praia Campeche começa em 25/04/2026.','2026-04-23 09:00:00',NULL,NULL,'needs_contact',NULL,'Hóspede sem email disponível para automação de email','2026-04-08 00:12:52'),(7,2,NULL,7,3,'email','Ana Clara',NULL,'Sua chegada está próxima','Olá, Ana Clara! Sua reserva no imóvel Studio Trindade começa em 09/04/2026.','2026-04-07 09:00:00',NULL,NULL,'needs_contact',NULL,'Hóspede sem email disponível para automação de email','2026-04-08 00:12:52'),(8,2,NULL,8,3,'email','Executivo Booking',NULL,'Sua chegada está próxima','Olá, Executivo Booking! Sua reserva no imóvel Studio Trindade começa em 13/04/2026.','2026-04-11 09:00:00',NULL,NULL,'needs_contact',NULL,'Hóspede sem email disponível para automação de email','2026-04-08 00:12:52'),(9,2,NULL,9,3,'email','Bloqueio',NULL,'Sua chegada está próxima','Olá, Bloqueio! Sua reserva no imóvel Studio Trindade começa em 20/04/2026.','2026-04-18 09:00:00',NULL,NULL,'needs_contact',NULL,'Hóspede sem email disponível para automação de email','2026-04-08 00:12:52'),(10,2,NULL,10,3,'email',NULL,NULL,'Sua chegada está próxima','Olá, Hóspede! Sua reserva no imóvel Studio Trindade começa em 15/04/2026.','2026-04-13 09:00:00',NULL,NULL,'needs_contact',NULL,'Hóspede sem email disponível para automação de email','2026-04-09 00:20:00'),(11,2,NULL,11,1,'email',NULL,NULL,'Sua chegada está próxima','Olá, Hóspede! Sua reserva no imóvel Loft Centro Floripa começa em 15/04/2026.','2026-04-13 09:00:00',NULL,NULL,'needs_contact',NULL,'Hóspede sem email disponível para automação de email','2026-04-09 00:30:00'),(12,2,NULL,12,4,'email','João Silva','joao@email.com','Sua chegada está próxima','Olá, João Silva! Sua reserva no imóvel Loft Teste Airbnb começa em 10/05/2026.','2026-05-08 09:00:00','2026-04-14 16:00:00','2026-04-20 19:30:57','sent',NULL,NULL,'2026-04-14 19:00:00'),(13,2,NULL,13,4,'email','João Silva',NULL,'Sua chegada está próxima','Olá, João Silva! Sua reserva no imóvel Loft Teste Airbnb começa em 10/05/2026.','2026-05-08 09:00:00',NULL,NULL,'needs_contact',NULL,'Hóspede sem email disponível para automação de email','2026-04-16 18:40:00'),(14,2,NULL,14,4,'email','João Silva',NULL,'Sua chegada está próxima','Olá, João Silva! Sua reserva no imóvel Loft Teste Airbnb começa em 10/05/2026.','2026-05-08 09:00:00',NULL,NULL,'needs_contact',NULL,'Hóspede sem email disponível para automação de email','2026-04-16 18:40:00'),(15,2,NULL,15,4,'email','João Silva',NULL,'Sua chegada está próxima','Olá, João Silva! Sua reserva no imóvel Loft Teste Airbnb começa em 10/05/2026.','2026-05-08 09:00:00',NULL,NULL,'needs_contact',NULL,'Hóspede sem email disponível para automação de email','2026-04-16 19:00:00'),(20,1,NULL,1,1,'email','Evandro','SEU_EMAIL@gmail.com','Teste StayFlow','<p>Email funcionando ?</p>','2026-04-20 19:24:37',NULL,NULL,'pending',NULL,NULL,'2026-04-20 22:24:37');
/*!40000 ALTER TABLE `message_logs` ENABLE KEYS */;
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
